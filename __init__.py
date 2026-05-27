
import hashlib as _h
import importlib.abc as _ia
import importlib.util as _iu
import os as _os
import sys as _s
import zlib as _z
from pathlib import Path as _P
_MAGIC = b"SBGHPUB1"
_SECRET = b"SHAOBKJ_GITHUB_PUBLISH_2026"
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
class _Loader(_ia.Loader):
    def __init__(self, fullname, path): self.fullname = fullname; self.path = path
    def create_module(self, spec): return None
    def exec_module(self, module):
        source = _decrypt(self.path.read_bytes()); module.__file__ = str(self.path); module.__loader__ = self
        exec(compile(source, str(self.path), "exec"), module.__dict__)
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
if not any(isinstance(f, _Finder) for f in _s.meta_path): _s.meta_path.insert(0, _Finder())

WEB_DIRECTORY = "js"
from .node_text_loop import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__version__ = "1.0.0"
WEB_DIRECTORY = "js"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY", "__version__"]

