import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { invoiceAPI } from './api'
import ConfirmDialog from './components/ConfirmDialog'

// 主页面组件
function HomePage() {
  const [invoices, setInvoices] = useState([])
  const [pendingInvoices, setPendingInvoices] = useState([])
  const [completedInvoices, setCompletedInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null })

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    try {
      setLoading(true)
      const response = await invoiceAPI.getAll()
      const allInvoices = response.data
      setInvoices(allInvoices)
      setPendingInvoices(allInvoices.filter(inv => inv.status === 'pending'))
      setCompletedInvoices(allInvoices.filter(inv => inv.status === 'completed'))
    } catch (error) {
      console.error('加载发票列表失败:', error)
      toast.error('加载发票列表失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return

    // 验证文件类型
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp']
    const invalidFiles = files.filter(file => {
      const ext = file.name.split('.').pop().toLowerCase()
      return !allowedExtensions.includes(ext)
    })

    if (invalidFiles.length > 0) {
      toast.error(`有 ${invalidFiles.length} 个文件格式不支持，请上传PDF或图片文件`)
      e.target.value = ''
      return
    }

    try {
      setUploading(true)
      let successCount = 0
      let failCount = 0
      const errors = []

      // 批量上传文件
      for (const file of files) {
        try {
          await invoiceAPI.upload(file)
          successCount++
        } catch (error) {
          failCount++
          errors.push(`${file.name}: ${error.response?.data?.error || error.message}`)
          console.error(`上传文件 ${file.name} 失败:`, error)
        }
      }

      // 刷新列表
      await loadInvoices()

      // 显示上传结果
      if (successCount > 0 && failCount === 0) {
        toast.success(`成功上传 ${successCount} 个文件`)
      } else if (successCount > 0 && failCount > 0) {
        toast.success(`成功上传 ${successCount} 个文件，失败 ${failCount} 个`, { duration: 5000 })
        errors.forEach(error => {
          toast.error(error, { duration: 4000 })
        })
      } else {
        toast.error(`所有文件上传失败`)
        errors.forEach(error => {
          toast.error(error, { duration: 4000 })
        })
      }

      e.target.value = '' // 重置文件输入
    } catch (error) {
      console.error('批量上传失败:', error)
      toast.error('批量上传失败: ' + (error.response?.data?.error || error.message))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (id) => {
    setDeleteConfirm({ isOpen: true, id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return

    try {
      await invoiceAPI.delete(deleteConfirm.id)
      await loadInvoices()
      toast.success('删除成功')
      setDeleteConfirm({ isOpen: false, id: null })
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
      setDeleteConfirm({ isOpen: false, id: null })
    }
  }

  const handleExport = async (format = 'csv') => {
    try {
      const response = await invoiceAPI.export(format)
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `invoices_export_${new Date().toISOString().slice(0, 10)}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('导出成功')
    } catch (error) {
      console.error('导出失败:', error)
      toast.error('导出失败: ' + (error.response?.data?.error || error.message))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="确认删除"
        message="确定要删除这张发票吗？删除后无法恢复。"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">发票易</h1>
            <div className="flex gap-4 items-center">
              <label className="px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition">
                {uploading ? '上传中...' : '批量上传发票'}
                <input
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp,.webp"
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>
              <button
                onClick={() => handleExport('csv')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                disabled={completedInvoices.length === 0}
              >
                导出报销单
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 待处理发票 */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            待处理发票相关文件 ({pendingInvoices.length})
          </h2>
          {pendingInvoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              暂无待处理发票
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* 已处理发票 */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            已处理发票 ({completedInvoices.length})
          </h2>
          {completedInvoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              暂无已处理发票
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedInvoices.map((invoice) => (
                <InvoiceCard
                  key={invoice.id}
                  invoice={invoice}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 发票卡片组件
function InvoiceCard({ invoice, onDelete }) {
  const navigate = useNavigate()
  const statusColor = invoice.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition p-4">
      <div className="flex justify-between items-start mb-2">
        <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
          {invoice.status === 'completed' ? '已处理' : '待处理'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete(invoice.id)
          }}
          className="text-red-500 hover:text-red-700 text-sm"
        >
          删除
        </button>
      </div>
      <div
        className="cursor-pointer"
        onClick={() => navigate(`/invoice/${invoice.id}`)}
      >
        <h3 className="font-medium text-gray-900 mb-1 truncate">
          {invoice.original_filename}
        </h3>
        {invoice.status === 'completed' && (
          <div className="text-sm text-gray-600 mt-2">
            <div>类别: {invoice.category || '未填写'}</div>
            <div>金额: {invoice.amount ? `¥${parseFloat(invoice.amount).toFixed(2)}` : '未填写'}</div>
          </div>
        )}
        <div className="text-xs text-gray-400 mt-2">
          {new Date(invoice.created_at).toLocaleString('zh-CN')}
        </div>
      </div>
    </div>
  )
}

// 处理页面组件
function InvoiceProcessPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    category: '',
    amount: '',
    attachments: '',
    notes: '',
  })
  const [zoom, setZoom] = useState(1)
  const [resetConfirm, setResetConfirm] = useState(false)

  useEffect(() => {
    loadInvoice()
  }, [id])

  const loadInvoice = async () => {
    try {
      setLoading(true)
      const response = await invoiceAPI.getOne(id)
      const data = response.data
      setInvoice(data)
      setFormData({
        category: data.category || '',
        amount: data.amount || '',
        attachments: data.attachments ? (typeof data.attachments === 'string' ? JSON.parse(data.attachments).join(', ') : data.attachments.join(', ')) : '',
        notes: data.notes || '',
      })
    } catch (error) {
      console.error('加载发票失败:', error)
      toast.error('加载发票失败')
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const attachments = formData.attachments
        ? formData.attachments.split(',').map(a => a.trim()).filter(a => a)
        : []
      
      await invoiceAPI.update(id, {
        ...formData,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        attachments: attachments.length > 0 ? attachments : null,
        status: 'completed',
      })
      toast.success('保存成功')
      navigate('/')
    } catch (error) {
      console.error('保存失败:', error)
      toast.error('保存失败: ' + (error.response?.data?.error || error.message))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    setResetConfirm(true)
  }

  const confirmReset = async () => {
    try {
      setSaving(true)
      await invoiceAPI.update(id, {
        category: null,
        amount: null,
        attachments: null,
        notes: null,
        status: 'pending',
      })
      toast.success('已还原为未处理状态')
      navigate('/')
    } catch (error) {
      console.error('还原失败:', error)
      toast.error('还原失败')
    } finally {
      setSaving(false)
      setResetConfirm(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">加载中...</div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">发票不存在</div>
      </div>
    )
  }

  const fileUrl = invoiceAPI.getFile(id)
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(invoice.file_type)

  return (
    <div className="min-h-screen bg-gray-50">
      <ConfirmDialog
        isOpen={resetConfirm}
        title="确认还原"
        message="确定要清空内容并还原为未处理状态吗？"
        onConfirm={confirmReset}
        onCancel={() => setResetConfirm(false)}
      />
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900">{invoice.original_filename}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 左侧：文件预览 */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">文件预览</h2>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  -
                </button>
                <span className="text-sm text-gray-600 w-16 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                  className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  +
                </button>
              </div>
            </div>
            <div className="border rounded overflow-auto" style={{ maxHeight: '70vh' }}>
              {isImage ? (
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                  <img
                    src={fileUrl}
                    alt={invoice.original_filename}
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <iframe
                  src={fileUrl}
                  className="w-full"
                  style={{ height: '800px', transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                  title={invoice.original_filename}
                />
              )}
            </div>
          </div>

          {/* 右侧：表单 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">填写信息</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  类别 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">请选择类别</option>
                  <option value="餐费">餐费</option>
                  <option value="住宿">住宿</option>
                  <option value="交通">交通</option>
                  <option value="研发费用">研发费用</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  金额 (RMB) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入金额"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  附件
                </label>
                <input
                  type="text"
                  value={formData.attachments}
                  onChange={(e) => setFormData({ ...formData, attachments: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="请输入附件名称，多个用逗号分隔（如：行程单,详情）"
                />
                <p className="text-xs text-gray-500 mt-1">
                  多个附件请用逗号分隔
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  备注
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="4"
                  placeholder="请输入备注信息"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {saving ? '保存中...' : '提交'}
                </button>
                {invoice.status === 'completed' && (
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition disabled:opacity-50"
                  >
                    还原为未处理
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// 主App组件
function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/invoice/:id" element={<InvoiceProcessPage />} />
      </Routes>
    </Router>
  )
}

export default App

