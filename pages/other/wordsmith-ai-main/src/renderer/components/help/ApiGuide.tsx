import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { HelpSection, HelpStep } from './HelpComponents'

export function ApiGuide() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>如何配置 API Key</CardTitle>
      </CardHeader>
      <CardContent>
        <HelpSection title="获取密钥">
          <HelpStep index={1} title="选择服务商">
            WordSmith AI 支持所有兼容 OpenAI 接口协议的服务商（如 DeepSeek, Moonshot, SiliconFlow 等）。
            推荐访问 <a href="https://platform.deepseek.com" target="_blank" className="text-zinc-700 underline hover:text-zinc-900">DeepSeek 开放平台</a> 注册账号。
          </HelpStep>
          <HelpStep index={2} title="创建 API Key">
            在服务商控制台找到 "API Keys" 菜单，点击创建新密钥。密钥通常以 <code>sk-</code> 开头。
            <div className="mt-2 rounded-xl bg-zinc-100 p-2 text-xs text-zinc-500">
              注意：密钥创建后只会显示一次，请妥善保存。
            </div>
          </HelpStep>
        </HelpSection>

        <div className="my-6 border-t border-zinc-200" />

        <HelpSection title="软件配置">
          <HelpStep index={3} title="填写配置">
            进入软件左侧的【设置】页面，在"模型配置"区域填写：
            <ul className="mt-2 list-disc pl-4">
              <li>BaseURL: 服务商提供的 API 地址 (例如 https://api.deepseek.com)</li>
              <li>API Key: 刚才获取的密钥</li>
              <li>Model: 模型名称 (例如 deepseek-chat)</li>
            </ul>
          </HelpStep>
        </HelpSection>
      </CardContent>
    </Card>
  )
}
