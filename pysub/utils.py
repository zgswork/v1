# utils.py
import socket, requests, uuid, platform, time, threading, getpass
from functools import wraps


def timeout_handler(seconds):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            result = [None]

            def target():
                try:
                    result[0] = func(*args, **kwargs)
                except:
                    result[0] = None

            t = threading.Thread(target=target)
            t.daemon = True
            t.start()
            t.join(seconds)
            return result[0]

        return wrapper

    return decorator


@timeout_handler(3)
def get_public_ip():
    try:
        resp = requests.get("https://api.ipify.org?format=json", timeout=3)
        return resp.json().get("ip")
    except:
        return None


@timeout_handler(3)
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        try:
            return socket.gethostbyname(socket.gethostname())
        except:
            return None


@timeout_handler(2)
def get_mac_address():
    try:
        mac = uuid.getnode()
        if (mac >> 40) % 2:
            return None
        mac_hex = f"{mac:012x}"
        return f"{mac_hex[0:2]}:{mac_hex[2:4]}:{mac_hex[4:6]}:{mac_hex[6:8]}:{mac_hex[8:10]}:{mac_hex[10:12]}"
    except:
        return None


@timeout_handler(1)
def get_hostname():
    try:
        return socket.gethostname()
    except:
        return None


@timeout_handler(1)
def get_username():
    try:
        return getpass.getuser()
    except:
        return None


@timeout_handler(1)
def get_os_info():
    try:
        return {
            "system": platform.system(),
            "node": platform.node(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
        }
    except:
        return None


def collect_client_info(request):
    return {
        "user_agent": request.headers.get("User-Agent", None),
        "referrer": request.referrer,
        "remote_ip": request.remote_addr,
        "public_ip": get_public_ip(),
        "local_ip": get_local_ip(),
        "mac_address": get_mac_address(),
        "hostname": get_hostname(),
        "username": get_username(),
        "os_info": get_os_info(),
        "server_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
    }


def parse_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in ("1", "true", "on", "yes")
