import subprocess
import sys
from importlib.metadata import distribution, PackageNotFoundError

# 尝试导入 packaging（通常作为 pip 的依赖存在）
try:  # 尝试普通安装
    subprocess.check_call([sys.executable, "-m", "pip", "install", "packaging"])
except subprocess.CalledProcessError as e:
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", "packaging"])  # 尝试用户安装 (--user)
    except subprocess.CalledProcessError as e:
        print(f"❌ packaging 安装失败，请手动处理。错误信息：{e}")
        sys.exit(1)
from packaging.specifiers import SpecifierSet
from packaging.version import parse as parse_version

# ===== 在这里配置您对每个包的版本要求 =====
# 键：包名（pip 安装名）
# 值：版本规格字符串（遵循 PEP 440），如 ">=2.0.0"、"==3.8.0"、""（不限制）
requirements = {
    "flask": ">=2.3.3",
    "requests": ">=2.32.5",
    "ezdxf": ">=1.3.0",
    "matplotlib": ">=3.10.5",
    "pyarmor": "",
    "pystray": ">=0.19.5",
    "pillow": ">=11.3.0",
    "python-barcode": ">=0.16.1",
    "jieba": ">=0.42.1",
    "qrcode": ">=8.2",
}


# ===========================================
def get_installed_version(pkg_name):  # 返回已安装版本，未安装返回 None
    try:
        dist = distribution(pkg_name)
        return dist.version
    except PackageNotFoundError:
        return None


def version_satisfies(version_str, spec_str):  # 判断版本字符串是否满足规格字符串（空规格表示总是满足）
    if not spec_str.strip():
        return True
    spec_set = SpecifierSet(spec_str)
    return parse_version(version_str) in spec_set


def install_package(pkg_name, spec_str):  # 安装/升级到满足规格的版本
    # 构造安装目标字符串，例如 "flask>=2.0.0" 或 "flask"
    target = f"{pkg_name}{spec_str}" if spec_str.strip() else pkg_name
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", target])
        return True
    except subprocess.CalledProcessError:
        print(f"⚠️ {pkg_name} 普通安装失败，尝试用户安装...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "--user", target])
            return True
        except subprocess.CalledProcessError as e:
            print(f"❌ {pkg_name} 安装失败，请手动处理。错误信息：{e}")
            return False


for pkg, spec in requirements.items():
    installed_ver = get_installed_version(pkg)
    if installed_ver is None:
        print(f"📦 {pkg} 未安装，将安装 {spec if spec else '最新版'}...")
        success = install_package(pkg, spec)
        if success:
            new_ver = get_installed_version(pkg)
            print(f"✅ {pkg} 安装完成，版本 {new_ver}")
        continue
    # 已安装，检查版本是否满足要求
    if version_satisfies(installed_ver, spec):
        print(f"✅ {pkg} 已安装版本 {installed_ver}，满足要求 '{spec}'，跳过。")
    else:
        print(f"🔄 {pkg} 当前版本 {installed_ver} 不满足要求 '{spec}'，正在升级/降级...")
        success = install_package(pkg, spec)
        if success:
            new_ver = get_installed_version(pkg)
            print(f"✅ {pkg} 已更新到版本 {new_ver}")
