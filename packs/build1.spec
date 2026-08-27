# -*- mode: python ; coding: utf-8 -*-
import os
SPEC_DIR = os.path.dirname(os.path.abspath(__file__))# 获取当前 .spec 文件所在的目录
ROOT_DIR = os.path.dirname(SPEC_DIR)# 项目根目录（因为 .spec 在"packs"子文件夹里，往上退一层就是根目录）
a = Analysis(
    [os.path.join(ROOT_DIR, 'app.pyw')],                             # 入口脚本
    pathex=[],                               # 额外的模块搜索路径
    binaries=[],                             # 需要打包的二进制文件（如 .dll / .so）,需要在这里以 ('源路径', '目标目录') 的形式加入。你的项目没有这种二进制依赖，所以为空。
    datas=[                                  #这是非常重要的列表，它指定了非 Python 文件（静态资源、模板、配置文件等）如何被复制到打包后的目录中。每条是一个元组 (源路径, 目标目录)：
        #('index.html', '.'),                 # 将根目录的 index.html 放在 exe 同级,已经移到pages文件夹下，就不再需要单独指定
        (os.path.join(ROOT_DIR, 'pages'), 'pages'),#文件夹
        (os.path.join(ROOT_DIR, 'static'), 'static'),
        (os.path.join(ROOT_DIR, 'pysub'), 'pysub'),                   
    ],
    hiddenimports=[                          # 隐式导入列表。PyInstaller 会扫描源码中的 import 语句，但有些模块是通过字符串或其他动态方式导入的（例如 importlib.import_module，或者像 ezdxf.addons.drawing 这种可能在运行时才被加载的子模块），PyInstaller 无法自动发现。这里你手动声明了：你自己的两个模块 dxf_generator 和 profile_engine（因为它们是被 Flask 路由中动态 reload 的）。ezdxf 内部的一些子模块（ezdxf.math、ezdxf.bbox、ezdxf.addons.drawing）。Matplotlib 的 PDF 后端和 pyplot（因为你在生成 PDF 时用到 matplotlib.backends.backend_pdf 和 plt，需要将它们包含进来，避免运行时找不到后端）。添加这些可以防止打包后出现 ModuleNotFoundError。
        'dxf_generator',                     # 手动导入的模块
        'profile_engine',
        'ezdxf.math',                        # ezdxf 内部子模块
        'ezdxf.bbox',
        'ezdxf.addons.drawing',
        'matplotlib.backends.backend_pdf',
        'matplotlib.pyplot',
    ],
    hookspath=[],                            # 自定义钩子（hook）路径,是 PyInstaller 用来处理特殊包的脚本，通常不需要你自己写，除非某些库有复杂的导入逻辑。留空即可。
    hooksconfig={},                          # 钩子配置,是 PyInstaller 用来处理特殊包的脚本，通常不需要你自己写，除非某些库有复杂的导入逻辑。留空即可。
    runtime_hooks=[],                        # 运行时钩子脚本,可以指定在 exe 启动时预先运行的 Python 脚本，用于设置环境变量等
    excludes=[],                             # 可以排除一些不需要的模块以减小体积，例如某些大而用不到的库。你没有指定，所以默认全部打包。
    noarchive=False,                         # 若设为 True，则所有 Python 字节码会以松散文件形式存放（而不是压缩成 .pyz 归档），这会影响启动速度。通常保持默认 False，使用归档以减小体积。
)

exe = EXE(                                   #前面打包好的 pyz 归档
    PYZ(a.pure),                             #a.pure 是 Analysis 收集到的所有纯 Python 模块（即 .py 文件）列表。PYZ 会将这些模块打包成一个压缩的 .pyz 文件，嵌入到最终的 exe 中。
    a.scripts,                               #入口脚本（编译后的字节码）
    a.binaries,                              # 收集到的二进制文件（.dll等）
    a.datas,                                 # 收集到的数据文件
    [],                                      # 额外要添加的脚本（留空）
    name='LED显示屏设计工具集V1.3.1',         # 生成的 exe 文件名（不含 .exe）
    debug=False,                             # 是否启用调试模式
    bootloader_ignore_signals=False,
    strip=False,                             # 是否剥离调试符号（减小体积）
    upx=True,                                # 是否使用 UPX 压缩可执行文件
    upx_exclude=[],
    runtime_tmpdir=None,                     # 运行时临时目录
    console=False,                           # 是否显示控制台窗口（GUI 应用）
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=os.path.join(ROOT_DIR, 'static', 'images', 'app.ico'),#可指定图标路径，如 'app.ico'
)