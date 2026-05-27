
import hashlib as _h
import importlib.abc as _ia
import importlib.util as _iu
import json as _json
import os as _os
import sys as _s
import zlib as _z
from pathlib import Path as _P
_MAGIC = b"SBGHPUB1"
_SECRET = b"SHAOBKJ_GITHUB_PUBLISH_2026"
_PLUGIN_NAME = 'ComfyUI_shaobkj-kyjd'
_SAFE_PLUGIN_NAME = 'ComfyUI_shaobkj-kyjd'
_ADMIN_KEY_HASH = 'fd7dd605966709bf28b9d51a6a2cf80280854f263f6961193d570acfca057ebb'
_AUTH_FILE = _P(__file__).resolve().parent / ".auth_ok"
_AUTH_ROUTE_PREFIX = f"/{_SAFE_PLUGIN_NAME}/auth"
def _stream(length, nonce):
    out = bytearray(); counter = 0
    while len(out) < length:
        out.extend(_h.sha256(_SECRET + nonce + counter.to_bytes(8, "big")).digest()); counter += 1
    return bytes(out[:length])
def _decrypt(data):
    if not data.startswith(_MAGIC): raise ImportError("Invalid encrypted module.")
    nonce = data[len(_MAGIC):len(_MAGIC) + 16]; payload = data[len(_MAGIC) + 16:]
    plain = bytes(v ^ k for v, k in zip(payload, _stream(len(payload), nonce)))
    return _z.decompress(plain).decode("utf-8-sig").lstrip("\ufeff")
def _is_authorized():
    try:
        payload = _json.loads(_AUTH_FILE.read_text(encoding="utf-8"))
        return payload.get("ok") is True and payload.get("admin_key_hash") == _ADMIN_KEY_HASH
    except Exception:
        return False
def _save_auth(access_key):
    if _h.sha256((access_key or "").strip().encode("utf-8")).hexdigest() != _ADMIN_KEY_HASH:
        return False
    _AUTH_FILE.write_text(_json.dumps({"ok": True, "admin_key_hash": _ADMIN_KEY_HASH}, ensure_ascii=False), encoding="utf-8")
    return True
def _register_auth_routes():
    try:
        from aiohttp import web as _web
        from server import PromptServer as _PromptServer
    except Exception:
        return
    routes = _PromptServer.instance.routes
    @routes.get(_AUTH_ROUTE_PREFIX + "/status")
    async def _shaobkj_release_auth_status(request):
        return _web.json_response({"ok": _is_authorized()})
    @routes.post(_AUTH_ROUTE_PREFIX + "/verify")
    async def _shaobkj_release_auth_verify(request):
        try:
            payload = await request.json()
        except Exception:
            payload = {}
        if _save_auth(payload.get("code") or ""):
            return _web.json_response({"ok": True, "message": "授权成功"})
        return _web.json_response({"ok": False, "message": "授权码错误"}, status=400)
def _wrap_node_class(cls):
    function_name = getattr(cls, "FUNCTION", None)
    if not function_name or getattr(cls, "_shaobkj_auth_wrapped", False): return cls
    original = getattr(cls, function_name, None)
    if not callable(original): return cls
    def _wrapped(self, *args, **kwargs):
        if not _is_authorized():
            raise PermissionError("未授权")
        return original(self, *args, **kwargs)
    setattr(cls, function_name, _wrapped)
    setattr(cls, "_shaobkj_auth_wrapped", True)
    return cls
def _wrap_node_mappings(namespace):
    mappings = namespace.get("NODE_CLASS_MAPPINGS")
    if isinstance(mappings, dict):
        for cls in mappings.values():
            if isinstance(cls, type): _wrap_node_class(cls)
class _Loader(_ia.Loader):
    def __init__(self, fullname, path): self.fullname = fullname; self.path = path
    def create_module(self, spec): return None
    def exec_module(self, module):
        source = _decrypt(self.path.read_bytes()); module.__file__ = str(self.path); module.__loader__ = self
        exec(compile(source, str(self.path), "exec"), module.__dict__)
        _wrap_node_mappings(module.__dict__)
class _Finder(_ia.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        prefix = __name__ + "."
        if not fullname.startswith(prefix): return None
        rel_path = fullname[len(prefix):].replace(".", _os.sep); base = _P(__file__).resolve().parent
        module_file = base / f"{rel_path}.py.sbgc"; package_file = base / rel_path / "__init__.py.sbgc"
        if module_file.is_file(): return _iu.spec_from_loader(fullname, _Loader(fullname, module_file))
        if package_file.is_file():
            spec = _iu.spec_from_loader(fullname, _Loader(fullname, package_file), is_package=True); spec.submodule_search_locations = [str(package_file.parent)]; return spec
        package_dir = base / rel_path
        if package_dir.is_dir():
            spec = _iu.spec_from_loader(fullname, loader=None, is_package=True); spec.submodule_search_locations = [str(package_dir)]; return spec
        return None
_register_auth_routes()
if not any(isinstance(f, _Finder) for f in _s.meta_path): _s.meta_path.insert(0, _Finder())

from .node_text_loop import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__version__ = "1.0.0"
WEB_DIRECTORY = "js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "__version__"]


WEB_DIRECTORY = "web"
_wrap_node_mappings(globals())
