# pysub/auth.py
from flask import Blueprint, request, jsonify, session
import json
import os
from functools import wraps

bp = Blueprint('auth', __name__, url_prefix='/auth')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_PATH = os.path.join(BASE_DIR, 'static', 'data', 'users.json')
MENUS_PATH = os.path.join(BASE_DIR, 'static', 'data', 'menus.json')

def load_users():
    with open(USERS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_users(users):
    with open(USERS_PATH, 'w', encoding='utf-8') as f:
        json.dump(users, f, ensure_ascii=False, indent=2)

def load_menus():
    with open(MENUS_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'success': False, 'message': '未登录'}), 401
        return f(*args, **kwargs)
    return decorated

# ---------- 基础认证 ----------
@bp.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    users = load_users()
    if username in users and users[username].get('password') == password:
        session['user'] = username
        return jsonify({
            'success': True,
            'menus': users[username].get('menus', [])
        })
    return jsonify({'success': False, 'message': '用户名或密码错误'}), 401

@bp.route('/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success': True})

@bp.route('/user', methods=['GET'])
def get_user():
    username = session.get('user')
    users = load_users()
    if username and username in users:
        menus = users[username].get('menus', [])
        return jsonify({'logged_in': True, 'username': username, 'menus': menus})
    else:
        guest_menus = users.get('guest', {}).get('menus', [])
        return jsonify({'logged_in': False, 'menus': guest_menus})

@bp.route('/menus', methods=['GET'])
def get_menus():
    menus = load_menus()
    return jsonify(menus)

# ---------- 用户管理（创建、更新、删除、列表） ----------
@bp.route('/create_user', methods=['POST'])
@login_required
def create_user():
    """
    创建新用户，新用户权限必须是当前用户权限的子集。
    请求体: { "new_username": "xxx", "password": "xxx", "menus": ["id1","id2"] }
    """
    data = request.json
    new_username = data.get('new_username')
    password = data.get('password')
    new_menus = data.get('menus', [])

    if not new_username or not password:
        return jsonify({'success': False, 'message': '用户名和密码不能为空'}), 400

    current_user = session.get('user')
    users = load_users()

    if new_username in users:
        return jsonify({'success': False, 'message': '用户名已存在'}), 400

    current_menus = users.get(current_user, {}).get('menus', [])
    # 允许拥有 "管理" 或 "创建" 权限的用户创建用户
    if not ('管理' in current_menus or '创建' in current_menus):
        return jsonify({'success': False, 'message': '当前用户无权限创建用户'}), 403

    if not set(new_menus).issubset(set(current_menus)):
        return jsonify({'success': False, 'message': '新用户权限不能超过当前用户权限'}), 403

    users[new_username] = {
        'password': password,
        'menus': new_menus
    }
    save_users(users)
    return jsonify({'success': True, 'message': f'用户 {new_username} 创建成功'})

@bp.route('/list_users', methods=['GET'])
@login_required
def list_users():
    """返回所有用户信息（不含密码，只标记是否有密码）"""
    current_user = session.get('user')
    users = load_users()
    if '管理' not in users.get(current_user, {}).get('menus', []):
        return jsonify({'success': False, 'message': '无权限'}), 403

    user_list = []
    for username, info in users.items():
        user_list.append({
            'username': username,
            'menus': info.get('menus', []),
            'has_password': bool(info.get('password'))
        })
    return jsonify(user_list)

@bp.route('/update_user', methods=['POST'])
@login_required
def update_user():
    """
    修改用户密码或权限（需 "管理" 权限）
    请求体: { "username": "xxx", "password": "newpass" (可选), "menus": [...] (可选) }
    注意：不能修改自己的权限，但可以修改自己的密码
    """
    current_user = session.get('user')
    users = load_users()
    if '管理' not in users.get(current_user, {}).get('menus', []):
        return jsonify({'success': False, 'message': '无权限'}), 403

    data = request.json
    target_user = data.get('username')
    if not target_user or target_user not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    # 不能修改自己的权限（但可修改密码）
    if target_user == current_user:
        if 'menus' in data:
            return jsonify({'success': False, 'message': '不能修改自己的权限'}), 403

    # 更新密码
    if 'password' in data and data['password']:
        users[target_user]['password'] = data['password']

    # 更新权限（仅当不是自己）
    if 'menus' in data and target_user != current_user:
        current_menus = users[current_user].get('menus', [])
        new_menus = data['menus']
        if not set(new_menus).issubset(set(current_menus)):
            return jsonify({'success': False, 'message': '分配的权限不能超过您的权限'}), 403
        users[target_user]['menus'] = new_menus

    save_users(users)
    return jsonify({'success': True, 'message': '更新成功'})

@bp.route('/delete_user', methods=['POST'])
@login_required
def delete_user():
    """删除用户（不能删除自己，也不能删除 guest）"""
    current_user = session.get('user')
    users = load_users()
    if '管理' not in users.get(current_user, {}).get('menus', []):
        return jsonify({'success': False, 'message': '无权限'}), 403

    data = request.json
    target_user = data.get('username')
    if not target_user:
        return jsonify({'success': False, 'message': '用户名缺失'}), 400
    if target_user == current_user:
        return jsonify({'success': False, 'message': '不能删除自己'}), 403
    if target_user == 'guest':
        return jsonify({'success': False, 'message': '不能删除内置游客账号'}), 403
    if target_user not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404

    del users[target_user]
    save_users(users)
    return jsonify({'success': True, 'message': f'用户 {target_user} 已删除'})

# ---------- 修改密码（普通用户自己修改） ----------
@bp.route('/change_password', methods=['POST'])
@login_required
def change_password():
    """普通用户修改自己的密码（需验证旧密码）"""
    data = request.json
    old_pwd = data.get('old_password')
    new_pwd = data.get('new_password')
    if not old_pwd or not new_pwd:
        return jsonify({'success': False, 'message': '旧密码和新密码不能为空'}), 400

    username = session.get('user')
    users = load_users()
    if username not in users:
        return jsonify({'success': False, 'message': '用户不存在'}), 404
    if users[username].get('password') != old_pwd:
        return jsonify({'success': False, 'message': '旧密码错误'}), 401

    users[username]['password'] = new_pwd
    save_users(users)
    return jsonify({'success': True, 'message': '密码修改成功'})