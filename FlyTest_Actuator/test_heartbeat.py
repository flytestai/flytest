"""An idle or busy actuator must keep its application-level online lease."""
import asyncio
import json
import unittest

import websockets
from websocket_client import WebSocketClient


class HeartbeatTests(unittest.IsolatedAsyncioTestCase):
    async def test_heartbeat_continues_while_message_handler_is_busy(self):
        heartbeats = []
        busy = asyncio.Event()
        release = asyncio.Event()
        received = asyncio.Event()

        async def server_handler(socket):
            await socket.recv()  # Initial actuator information.
            await socket.send(json.dumps({'code': 200, 'msg': 'long-running task'}))
            async for raw in socket:
                if json.loads(raw).get('msg') == 'heartbeat':
                    heartbeats.append(raw)
                    if len(heartbeats) >= 2:
                        received.set()

        async def slow_handler(message):
            busy.set()
            await release.wait()

        async with websockets.serve(server_handler, '127.0.0.1', 0) as server:
            port = server.sockets[0].getsockname()[1]
            client = WebSocketClient(f'ws://127.0.0.1:{port}', 'heartbeat-test')
            client.HEARTBEAT_INTERVAL = 0.03
            client.set_message_handler(slow_handler)
            task = asyncio.create_task(client.run())
            try:
                await asyncio.wait_for(busy.wait(), timeout=3)
                await asyncio.wait_for(received.wait(), timeout=3)
                self.assertFalse(release.is_set())
                self.assertGreaterEqual(len(heartbeats), 2)
            finally:
                release.set()
                await client.disconnect()
                await asyncio.wait_for(task, timeout=3)
            count = len(heartbeats)
            await asyncio.sleep(0.1)
            self.assertEqual(len(heartbeats), count)

    async def test_disconnected_client_does_not_send_heartbeats(self):
        from unittest.mock import AsyncMock
        client = WebSocketClient('ws://127.0.0.1:1')
        client.HEARTBEAT_INTERVAL = 0.01
        client.send = AsyncMock()
        task = asyncio.create_task(client._heartbeat_loop())
        try:
            await asyncio.sleep(0.05)
            client.send.assert_not_awaited()
        finally:
            client._stop_event.set()
            await asyncio.wait_for(task, timeout=1)


if __name__ == '__main__':
    unittest.main()
