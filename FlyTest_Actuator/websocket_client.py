"""
UI automation actuator websocket client.
"""

import asyncio
import json
import logging
import time
from typing import Any, Callable, Optional
from urllib.parse import parse_qsl, urlencode, urlparse, urlsplit, urlunsplit

import httpx
import websockets
from websockets.client import WebSocketClientProtocol

from models import NoticeType, QueueModel, ResponseCode, SocketDataModel, UiSocketEnum

logger = logging.getLogger("actuator")
logging.getLogger("httpx").setLevel(logging.WARNING)


class WebSocketClient:
    """WebSocket client for the Django backend."""

    VERSION = "1.0.0"

    def __init__(self, url: str, actuator_id: str = "default", config: Any = None):
        self.url = url
        self.actuator_id = actuator_id
        self.config = config
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.connected = False
        self.reconnect_interval = 5
        self.max_reconnect_attempts = 0
        self._message_handler: Optional[Callable[[SocketDataModel], Any]] = None
        self._stop_event = asyncio.Event()
        self._next_token_fetch_at = 0.0

    def set_message_handler(self, handler: Callable[[SocketDataModel], Any]):
        self._message_handler = handler

    def _build_origin(self) -> Optional[str]:
        source_url = getattr(self.config, "api_url", None) if self.config else None
        if not source_url:
            source_url = self.url

        parsed = urlparse(source_url)
        if not parsed.netloc:
            return None

        scheme = "https" if parsed.scheme in ("https", "wss") else "http"
        return f"{scheme}://{parsed.netloc}"

    @staticmethod
    def _should_bypass_proxy(raw_url: str) -> bool:
        parsed = urlparse(raw_url)
        hostname = (parsed.hostname or "").lower()
        return hostname in {"127.0.0.1", "localhost", "::1"}

    def _has_api_credentials(self) -> bool:
        if not self.config:
            return False
        return bool(
            getattr(self.config, "api_url", None)
            and getattr(self.config, "api_username", None)
            and getattr(self.config, "api_password", None)
        )

    def _clear_cached_tokens(self) -> None:
        if not self.config:
            return
        setattr(self.config, "access_token", None)
        setattr(self.config, "refresh_token", None)

    def _get_access_token(self) -> Optional[str]:
        token = getattr(self.config, "access_token", None) if self.config else None
        if token:
            return token

        now = time.monotonic()
        if now < self._next_token_fetch_at:
            return None

        api_url = getattr(self.config, "api_url", None) if self.config else None
        username = getattr(self.config, "api_username", None) if self.config else None
        password = getattr(self.config, "api_password", None) if self.config else None
        if not api_url or not username or not password:
            return None

        request_url = f"{api_url.rstrip('/')}/api/token/"
        trust_env = not self._should_bypass_proxy(request_url)
        try:
            with httpx.Client(trust_env=trust_env, timeout=15.0) as client:
                response = client.post(
                    request_url,
                    json={"username": username, "password": password},
                )
        except Exception as exc:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.error("Failed to fetch token: %s", exc)
            return None

        if response.status_code == 429:
            retry_after = 5.0
            retry_after_header = response.headers.get("Retry-After")
            if retry_after_header:
                try:
                    retry_after = max(float(retry_after_header), 1.0)
                except ValueError:
                    retry_after = 5.0
            self._next_token_fetch_at = time.monotonic() + retry_after
            logger.warning("Token request rate limited, retrying in %.0fs", retry_after)
            return None

        if response.status_code != 200:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.error("Failed to fetch token: HTTP %s", response.status_code)
            return None

        try:
            token_payload = response.json()
        except ValueError:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.error("Failed to decode token response as JSON")
            return None

        token = token_payload.get("access")
        if not token and isinstance(token_payload.get("data"), dict):
            token = token_payload["data"].get("access")
        if not token:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.warning("Token response did not contain an access token")
            return None

        self._next_token_fetch_at = 0.0
        if self.config is not None:
            setattr(self.config, "access_token", token)
            refresh_token = token_payload.get("refresh")
            if not refresh_token and isinstance(token_payload.get("data"), dict):
                refresh_token = token_payload["data"].get("refresh")
            if refresh_token:
                setattr(self.config, "refresh_token", refresh_token)
        return token

    def _build_connect_url(self, access_token: Optional[str] = None) -> str:
        split_result = urlsplit(self.url)
        query = dict(parse_qsl(split_result.query, keep_blank_values=True))
        query["actuator_id"] = self.actuator_id
        if access_token is None:
            access_token = self._get_access_token()
        if access_token:
            query["token"] = access_token
        return urlunsplit(
            (
                split_result.scheme,
                split_result.netloc,
                split_result.path,
                urlencode(query),
                split_result.fragment,
            )
        )

    async def connect(self) -> bool:
        try:
            access_token = self._get_access_token()
            if self._has_api_credentials() and not access_token:
                logger.warning("Skipping websocket connect because no valid token is available yet")
                self.connected = False
                return False

            connect_url = self._build_connect_url(access_token=access_token)
            origin = self._build_origin()
            self.websocket = await websockets.connect(
                connect_url,
                origin=origin,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=10,
            )
            self.connected = True
            logger.info("Connected to server: %s", self.url)
            await self._send_actuator_info()
            return True
        except Exception as exc:
            message = str(exc)
            if any(code in message for code in ("401", "403", "4401")):
                self._clear_cached_tokens()
                self._next_token_fetch_at = 0.0
            logger.error("Connection failed: %s", exc)
            self.connected = False
            return False

    async def _send_actuator_info(self):
        actuator_info = {
            "name": getattr(self.config, "actuator_name", None) or self.actuator_id,
            "type": "web_ui",
            "is_open": True,
            "debug": False,
            "version": self.VERSION,
        }

        if self.config:
            actuator_info["browser_type"] = getattr(self.config, "browser_type", "chromium")
            actuator_info["headless"] = getattr(self.config, "headless", False)

        await self.send(
            SocketDataModel(
                code=ResponseCode.SUCCESS,
                msg="set actuator info",
                data=QueueModel(
                    func_name=UiSocketEnum.SET_ACTUATOR_INFO,
                    func_args=actuator_info,
                ),
            )
        )
        logger.info("Sent actuator info: %s", actuator_info)

    async def disconnect(self):
        self._stop_event.set()
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        self.connected = False
        logger.info("Disconnected from server")

    async def send(self, data: SocketDataModel):
        if not self.websocket or not self.connected:
            logger.error("Cannot send message because websocket is not connected")
            return False

        try:
            await self.websocket.send(data.model_dump_json())
            return True
        except Exception as exc:
            logger.error("Failed to send message: %s", exc)
            self.connected = False
            return False

    async def send_result(self, func_name: str, args: dict, user: Optional[str] = None):
        await self.send(
            SocketDataModel(
                code=ResponseCode.SUCCESS,
                msg="result",
                user=user,
                is_notice=NoticeType.WEB,
                data=QueueModel(func_name=func_name, func_args=args),
            )
        )

    async def receive_loop(self):
        while not self._stop_event.is_set():
            if not self.connected or not self.websocket:
                await self._reconnect()
                continue

            try:
                message = await asyncio.wait_for(self.websocket.recv(), timeout=1.0)
                await self._handle_message(message)
            except asyncio.TimeoutError:
                continue
            except websockets.exceptions.ConnectionClosed:
                logger.warning("Websocket connection closed, preparing to reconnect")
                self.connected = False
            except Exception as exc:
                logger.error("Failed to receive message: %s", exc)
                self.connected = False

    async def _reconnect(self):
        attempts = 0
        while not self._stop_event.is_set():
            attempts += 1
            logger.info("Reconnect attempt (%s)...", attempts)

            if await self.connect():
                return

            if self.max_reconnect_attempts > 0 and attempts >= self.max_reconnect_attempts:
                logger.error("Reached maximum reconnect attempts, stopping client")
                self._stop_event.set()
                return

            await asyncio.sleep(self.reconnect_interval)

    async def _handle_message(self, message: str):
        try:
            data = json.loads(message)
            socket_data = SocketDataModel(**data)

            if self._message_handler:
                await self._message_handler(socket_data)
            else:
                logger.warning("Received message without a handler: %s", socket_data.msg)
        except json.JSONDecodeError as exc:
            logger.error("Failed to decode message JSON: %s", exc)
        except Exception as exc:
            logger.error("Failed to handle message: %s", exc)

    async def run(self):
        if not await self.connect():
            logger.error("Initial connection failed")

        await self.receive_loop()
