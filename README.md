# 发票易 - 发票管理平台

一个用于管理和整理发票的Web平台，支持PDF和图片格式的发票上传、预览、分类和导出。
<img width="2747" height="982" alt="image" src="https://github.com/user-attachments/assets/afba6217-b048-4188-aba3-98268f410b32" />

<img width="2747" height="1402" alt="image" src="https://github.com/user-attachments/assets/2492e626-2c31-4cee-89bf-d2b8f7f6a2a4" />


## 功能特性

- 📤 **批量文件上传**：支持同时上传多个PDF和图片格式的发票文件
- 📋 **待处理列表**：显示所有待处理的发票文件
- ✅ **已处理列表**：显示已完成填写的发票
- 🔍 **文件预览**：支持PDF和图片预览，可放大缩小
- 📝 **信息填写**：填写发票类别、金额、附件、备注等信息
- ✏️ **编辑功能**：可重新编辑已处理的发票
- 🔄 **状态管理**：可将已处理发票还原为未处理状态
- 📊 **导出功能**：导出为CSV格式，按类别分组，包含统计信息

## 技术栈

- **后端**：Python + Flask + SQLite
- **前端**：React + Vite + Tailwind CSS
- **路由**：React Router
- **通知组件**：react-hot-toast（用于消息提示）

## 项目结构

```
发票助手t3/
├── backend/          # Flask后端
│   ├── app.py       # Flask应用主文件
│   ├── requirements.txt
│   ├── uploads/     # 上传文件存储目录
│   └── database/    # SQLite数据库目录
├── frontend/        # React前端
│   ├── src/
│   │   ├── App.jsx  # 主应用组件
│   │   ├── api.js   # API服务
│   │   ├── main.jsx # 入口文件
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 安装和运行

### 后端设置

1. 进入后端目录：
```bash
cd backend
```

2. 创建虚拟环境（推荐）：
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. 安装依赖：
```bash
pip install -r requirements.txt
```

4. 运行Flask服务器：
```bash
python app.py
```

后端服务将在 `http://localhost:5000` 启动

### 前端设置

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 运行开发服务器：
```bash
npm run dev
```

前端应用将在 `http://localhost:3000` 启动

## 使用说明

1. **上传发票**：点击右上角"上传发票"按钮，选择PDF或图片文件
2. **处理发票**：在"待处理发票相关文件"列表中点击发票卡片进入处理页面
3. **填写信息**：
   - 选择类别（餐费、住宿、交通、研发费用）
   - 填写金额（RMB）
   - 填写附件（多个用逗号分隔）
   - 填写备注
   - 点击"提交"完成处理
4. **编辑发票**：在"已处理发票"列表中点击发票可重新编辑
5. **还原状态**：在处理页面点击"还原为未处理"可将发票还原为未处理状态
6. **导出报销单**：点击右上角"导出报销单"按钮，导出为CSV格式

## API接口

- `GET /api/invoices` - 获取所有发票列表（可带status参数筛选）
- `GET /api/invoices/:id` - 获取单个发票详情
- `POST /api/invoices` - 上传发票文件
- `PUT /api/invoices/:id` - 更新发票信息
- `DELETE /api/invoices/:id` - 删除发票
- `GET /api/invoices/:id/file` - 获取发票文件
- `GET /api/invoices/export` - 导出发票为CSV

## 注意事项

- 支持的文件格式：PDF、PNG、JPG、JPEG、GIF、BMP、WEBP
- 单个文件最大16MB
- 上传的文件存储在 `backend/uploads/` 目录
- 数据库文件存储在 `backend/database/invoices.db`

## 开发环境

- Python 3.8+
- Node.js 16+
- npm 或 yarn

