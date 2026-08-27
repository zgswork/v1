# Blockchain-Toolkit-Pro
一款基于 JavaScript + HTML 开发的多功能区块链工具集合，涵盖钱包生成、哈希计算、加密解密、交易模拟、共识算法、NFT 工具、链上数据分析等核心功能，支持本地离线运行，无需依赖第三方服务，轻量化、易部署、开箱即用，适配区块链学习、开发测试、日常工具使用等多场景需求。

## 包含文件及功能
1. **blockchain_wallet_generator.html**：离线生成区块链钱包地址、私钥、公钥，支持 BTC/ETH 格式兼容
2. **sha256_hash_calculator.html**：SHA256 哈希算法计算器，支持文本/文件哈希值计算
3. **ethereum_tx_builder.html**：以太坊离线交易构造器，自定义交易参数生成原始交易数据
4. **rsa_encrypt_tool.html**：RSA 非对称加密解密工具，生成密钥对并加解密文本数据
5. **block_miner_simulator.html**：区块挖矿模拟工具，实现工作量证明（PoW）共识挖矿过程
6. **merkle_tree_generator.html**：默克尔树生成工具，计算默克尔根与节点哈希
7. **nft_metadata_creator.html**：NFT 元数据生成器，自定义 NFT 属性生成标准元数据文件
8. **pos_consensus_sim.html**：权益证明（PoS）共识算法模拟，验证节点出块逻辑
9. **base58_encoder.html**：Base58 编码解码工具，适配区块链地址编码规则
10. **digital_signer_tool.html**：数字签名生成与验证工具，基于椭圆曲线算法
11. **block_explorer_sim.html**：简易区块链浏览器模拟，查询区块、交易、地址信息
12. **aes_block_encrypt.html**：AES 区块加密工具，对称加密区块链敏感数据
13．**token_contract_simulator.html**：同质化代币合约模拟，实现转账、余额查询功能
14. **p2p_network_sim.html**：区块链 P2P 网络模拟，节点连接、数据同步可视化
15. **hex_converter_tool.html**：十六进制编码转换工具，区块链数据格式快速转换
16. **tx_fee_calculator.html**：区块链交易手续费计算器，支持多链费率估算
17. **bip39_generator.html**：BIP39 助记词生成工具，离线生成 12/24 位助记词
18. **smart_contract_debug.html**：智能合约调试模拟器，测试合约执行逻辑与结果
19. **hash_compare_tool.html**：多哈希算法对比工具，支持 SHA256/SHA512/MD5 对比
20. **utxo_manager_sim.html**：UTXO 模型管理工具，模拟比特币 UTXO 交易逻辑
21. **chain_deploy_sim.html**：区块链部署模拟器，本地模拟公链/私链部署流程
22. **ecc_key_generator.html**：椭圆曲线密钥生成工具，生成区块链专用 ECC 密钥对
23. **nft_minter_sim.html**：NFT 铸造模拟器，模拟 NFT 发行与转账流程
24. **abi_parser_tool.html**：智能合约 ABI 解析器，解析 ABI 并生成调用方法
25. **block_validate_tool.html**：区块合法性验证工具，校验区块哈希、交易数据
26. **cross_chain_sim.html**：跨链交易模拟器，模拟跨链资产转移与验证逻辑
27. **base64_encoder.html**：Base64 编码解码工具，适配区块链数据传输格式
28. **staking_calculator.html**：质押收益计算器，计算 PoS 链节点质押年化收益
29. **gas_estimator_tool.html**：以太坊 Gas 费估算工具，实时估算交易 Gas 消耗
30. **multi_sig_wallet.html**：多签钱包模拟器，实现多节点签名授权交易功能
31. **chain_data_analyze.html**：区块链数据可视化分析工具，展示区块高度、交易趋势
32. **privkey_encrypt_tool.html**：私钥加密存储工具，AES 加密本地存储私钥文件
33. **dao_vote_sim.html**：DAO 治理投票模拟器，模拟链上提案、投票、计票流程
34. **tx_pending_monitor.html**：交易待确认监控模拟器，追踪交易打包状态
35. **light_node_sim.html**：区块链轻节点模拟器，轻量级同步区块头与核心数据
36. **swap_router_sim.html**：去中心化交易所路由模拟器，模拟代币兑换与滑点计算
37. **hash_time_lock.html**：哈希时间锁合约工具，实现跨链原子交换功能
38. **chain_peer_manager.html**：区块链节点管理工具，添加/删除节点、同步网络状态

## 使用说明
所有文件均为独立 HTML 页面，直接在浏览器打开即可使用，无需安装依赖，所有计算均在本地完成，保障数据安全与隐私。
