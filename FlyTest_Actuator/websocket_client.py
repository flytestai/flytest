"""
UI自动化执行器 - WebSocket客户端

"""

import asyncio
import json
import logging
import time
from typing import Optional, Callable, Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, urlopen
import websockets
from websockets.client import WebSocketClientProtocol

from models import SocketDataModel, QueueModel, ResponseCode, NoticeType, UiSocketEnum

logger = logging.getLogger('actuator')


class WebSocketClient:
    """WebSocket客户端 - 连接Django后端"""
    
    VERSION = '1.0.0'
    
    def __init__(self, url: str, actuator_id: str = 'default', config: Any = None):
        self.url = url
        self.actuator_id = actuator_id
        self.config = config
        self.websocket: Optional[WebSocketClientProtocol] = None
        self.connected = False
        self.reconnect_interval = 5  # 重连间隔(秒)
        self.max_reconnect_attempts = 0  # 0表示无限重试
        self._message_handler: Optional[Callable] = None
        self._stop_event = asyncio.Event()
        self._next_token_fetch_at = 0.0
    
    def set_message_handler(self, handler: Callable[[SocketDataModel], Any]):
        """设置消息处理器"""
        self._message_handler = handler

    def _build_origin(self) -> Optional[str]:
        source_url = getattr(self.config, 'api_url', None) if self.config else None
        if not source_url:
            source_url = self.url

        parsed = urlparse(source_url)
        if not parsed.netloc:
            return None

        scheme = 'https' if parsed.scheme in ('https', 'wss') else 'http'
        return f'{scheme}://{parsed.netloc}'

    def _has_api_credentials(self) -> bool:
        if not self.config:
            return False
        return bool(
            getattr(self.config, 'api_url', None)
            and getattr(self.config, 'api_username', None)
            and getattr(self.config, 'api_password', None)
        )

    def _clear_cached_tokens(self) -> None:
        if not self.config:
            return
        setattr(self.config, 'access_token', None)
        setattr(self.config, 'refresh_token', None)

    def _get_access_token(self) -> Optional[str]:
        token = getattr(self.config, 'access_token', None) if self.config else None
        if token:
            return token

        now = time.monotonic()
        if now < self._next_token_fetch_at:
            return None

        api_url = getattr(self.config, 'api_url', None) if self.config else None
        username = getattr(self.config, 'api_username', None) if self.config else None
        password = getattr(self.config, 'api_password', None) if self.config else None
        if not api_url or not username or not password:
            return None

        request = Request(
            f"{api_url.rstrip('/')}/api/token/",
            data=json.dumps({"username": username, "password": password}).encode('utf-8'),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=15) as response:
                token_payload = json.loads(response.read().decode('utf-8'))
        except HTTPError as exc:
            retry_after = 5.0
            retry_after_header = exc.headers.get('Retry-After') if exc.headers else None
            if retry_after_header:
                try:
                    retry_after = max(float(retry_after_header), 1.0)
                except ValueError:
                    retry_after = 5.0
            self._next_token_fetch_at = time.monotonic() + retry_after
            if exc.code == 429:
                logger.warning(f"鑾峰彇 Token 瑙﹀彂闄愭祦锛?{retry_after:.0f} 绉掑悗鍐嶈瘯")
                return None
            logger.error(f"鑾峰彇 Token 澶辫触: HTTP {exc.code}")
            return None
        except URLError as exc:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.error(f"鑾峰彇 Token 璇锋眰澶辫触: {exc}")
            return None

        token = token_payload.get('access')
        if not token and isinstance(token_payload.get('data'), dict):
            token = token_payload['data'].get('access')
        if not token:
            self._next_token_fetch_at = time.monotonic() + 5.0
            logger.warning("Token 鍝嶅簲涓湭鎵惧埌 access 瀛楁锛?5 绉掑悗鍐嶈瘯")
            return None
        self._next_token_fetch_at = 0.0
        if token and self.config is not None:
            setattr(self.config, 'access_token', token)
            refresh_token = token_payload.get('refresh')
            if not refresh_token and isinstance(token_payload.get('data'), dict):
                refresh_token = token_payload['data'].get('refresh')
            if refresh_token:
                setattr(self.config, 'refresh_token', refresh_token)
        return token

    def _build_connect_url(self, access_token: Optional[str] = None) -> str:
        split_result = urlsplit(self.url)
        query = dict(parse_qsl(split_result.query, keep_blank_values=True))
        query['actuator_id'] = self.actuator_id
        if access_token is None:
            access_token = self._get_access_token()
        if access_token:
            query['token'] = access_token
        return urlunsplit((
            split_result.scheme,
            split_result.netloc,
            split_result.path,
            urlencode(query),
            split_result.fragment,
        ))
    
    async def connect(self) -> bool:
        """建立WebSocket连接"""
        try:
            # 连接URL带上actuator_id
            access_token = self._get_access_token()
            if self._has_api_credentials() and not access_token:
                logger.warning("鏈兘鑾峰彇鍒版湁鏁?Token锛屾殏涓嶅彂璧?WebSocket 杩炴帴")
                self.connected = False
                return False
            connect_url = self._build_connect_url(access_token=access_token)
            origin = self._build_origin()
            self.websocket = await websockets.connect(
                connect_url,
                origin=origin,
                ping_interval=30,
                ping_timeout=10,
                close_timeout=10
            )
            self.connected = True
            logger.info(f"已连接到服务器: {self.url}")
            
            # 连接成功后发送执行器信息
            await self._send_actuator_info()
            return True
        except Exception as e:
            message = str(e)
            if any(code in message for code in ('401', '403', '4401')):
                self._clear_cached_tokens()
                self._next_token_fetch_at = 0.0
            logger.error(f"连接失败: {e}")
            self.connected = False
            return False
    
    async def _send_actuator_info(self):
        """发送执行器信息到服务端"""
        actuator_info = {
            'name': getattr(self.config, 'actuator_name', None) or self.actuator_id,
            'type': 'web_ui',
            'is_open': True,
            'debug': False,
            'version': self.VERSION,
        }
        
        # 从配置中获取浏览器相关设置
        if self.config:
            actuator_info['browser_type'] = getattr(self.config, 'browser_type', 'chromium')
            actuator_info['headless'] = getattr(self.config, 'headless', False)
        
        await self.send(SocketDataModel(
            code=ResponseCode.SUCCESS,
            msg='设置执行器信息',
            data=QueueModel(
                func_name=UiSocketEnum.SET_ACTUATOR_INFO,
                func_args=actuator_info
            )
        ))
        logger.info(f"已发送执行器信息: {actuator_info}")
    
    async def disconnect(self):
        """断开连接"""
        self._stop_event.set()
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        self.connected = False
        logger.info("已断开连接")
    
    async def send(self, data: SocketDataModel):
        """发送消息"""
        if not self.websocket or not self.connected:
            logger.error("未连接，无法发送消息")
            return False
        
        try:
            await self.websocket.send(data.model_dump_json())
            return True
        except Exception as e:
            logger.error(f"发送消息失败: {e}")
            self.connected = False
            return False
    
    async def send_result(self, func_name: str, args: dict, user: Optional[str] = None):
        """发送执行结果"""
        await self.send(SocketDataModel(
            code=ResponseCode.SUCCESS,
            msg='result',
            user=user,
            is_notice=NoticeType.WEB,
            data=QueueModel(func_name=func_name, func_args=args)
        ))
    
    async def receive_loop(self):
        """接收消息循环"""
        while not self._stop_event.is_set():
            if not self.connected or not self.websocket:
                # 尝试重连
                await self._reconnect()
                continue
            
            try:
                message = await asyncio.wait_for(
                    self.websocket.recv(),
                    timeout=1.0
                )
                await self._handle_message(message)
            except asyncio.TimeoutError:
                continue
            except websockets.exceptions.ConnectionClosed:
                logger.warning("连接已关闭，准备重连")
                self.connected = False
            except Exception as e:
                logger.error(f"接收消息错误: {e}")
                self.connected = False
    
    async def _reconnect(self):
        """重连逻辑"""
        attempts = 0
        while not self._stop_event.is_set():
            attempts += 1
            logger.info(f"尝试重连 ({attempts})...")
            
            if await self.connect():
                return
            
            if self.max_reconnect_attempts > 0 and attempts >= self.max_reconnect_attempts:
                logger.error("达到最大重连次数，停止重连")
                self._stop_event.set()
                return
            
            await asyncio.sleep(self.reconnect_interval)
    
    async def _handle_message(self, message: str):
        """处理接收到的消息"""
        try:
            data = json.loads(message)
            socket_data = SocketDataModel(**data)
            
            if self._message_handler:
                await self._message_handler(socket_data)
            else:
                logger.warning(f"收到消息但没有处理器: {socket_data.msg}")
        except json.JSONDecodeError as e:
            logger.error(f"消息JSON解析错误: {e}")
        except Exception as e:
            logger.error(f"处理消息错误: {e}")
    
    async def run(self):
        """运行客户端"""
        if not await self.connect():
            logger.error("初始连接失败")
        
        await self.receive_loop()
