import axios from 'axios'

const API_BASE_URL = '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 发票相关API
export const invoiceAPI = {
  // 获取所有发票
  getAll: (status) => {
    const params = status ? { status } : {}
    return api.get('/invoices', { params })
  },

  // 获取单个发票
  getOne: (id) => {
    return api.get(`/invoices/${id}`)
  },

  // 上传发票
  upload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/invoices', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  // 更新发票
  update: (id, data) => {
    return api.put(`/invoices/${id}`, data)
  },

  // 删除发票
  delete: (id) => {
    return api.delete(`/invoices/${id}`)
  },

  // 获取发票文件
  getFile: (id) => {
    return `${API_BASE_URL}/invoices/${id}/file`
  },

  // 导出发票
  export: (format = 'csv') => {
    return api.get('/invoices/export', {
      params: { format },
      responseType: 'blob',
    })
  },
}

export default api

