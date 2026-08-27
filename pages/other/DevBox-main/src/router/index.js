import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/json'
  },
  {
    path: '/json',
    name: 'JsonTool',
    component: () => import('@/views/JsonTool.vue'),
    meta: { title: 'JSON格式化' }
  },
  {
    path: '/timestamp',
    name: 'TimestampTool',
    component: () => import('@/views/TimestampTool.vue'),
    meta: { title: '时间戳转换' }
  },
  {
    path: '/encode',
    name: 'EncodeTool',
    component: () => import('@/views/EncodeTool.vue'),
    meta: { title: '编码解码' }
  },
  {
    path: '/base64',
    name: 'Base64Tool',
    component: () => import('@/views/Base64Tool.vue'),
    meta: { title: 'Base64转换' }
  },
  {
    path: '/qrcode',
    name: 'QrcodeTool',
    component: () => import('@/views/QrcodeTool.vue'),
    meta: { title: '二维码生成' }
  },
  {
    path: '/regex',
    name: 'RegexTool',
    component: () => import('@/views/RegexTool.vue'),
    meta: { title: '正则测试' }
  },
  {
    path: '/color',
    name: 'ColorTool',
    component: () => import('@/views/ColorTool.vue'),
    meta: { title: '颜色取色' }
  },
  {
    path: '/password',
    name: 'PasswordTool',
    component: () => import('@/views/PasswordTool.vue'),
    meta: { title: '密码生成' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
