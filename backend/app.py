from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sqlite3
import os
import json
import csv
import io
from datetime import datetime
import uuid

app = Flask(__name__)
CORS(app)

# 配置
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# 确保上传目录存在
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs('database', exist_ok=True)

# 数据库初始化
def init_db():
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            category TEXT,
            amount REAL,
            attachments TEXT,
            notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')
    # 附件关系表：存储文件之间的附件关系
    c.execute('''
        CREATE TABLE IF NOT EXISTS invoice_attachments (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            attachment_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
            FOREIGN KEY (attachment_id) REFERENCES invoices(id) ON DELETE CASCADE,
            UNIQUE(invoice_id, attachment_id)
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# API路由

@app.route('/api/invoices', methods=['GET'])
def get_invoices():
    """获取所有发票列表"""
    status = request.args.get('status', None)
    conn = sqlite3.connect('database/invoices.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    if status:
        c.execute('SELECT * FROM invoices WHERE status = ? ORDER BY created_at DESC', (status,))
    else:
        c.execute('SELECT * FROM invoices ORDER BY created_at DESC')
    
    invoices = [dict(row) for row in c.fetchall()]
    conn.close()
    return jsonify(invoices)

@app.route('/api/invoices/<invoice_id>', methods=['GET'])
def get_invoice(invoice_id):
    """获取单个发票详情"""
    conn = sqlite3.connect('database/invoices.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
    invoice = c.fetchone()
    conn.close()
    
    if invoice:
        return jsonify(dict(invoice))
    return jsonify({'error': 'Invoice not found'}), 404

@app.route('/api/invoices', methods=['POST'])
def upload_invoice():
    """上传发票文件"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
    
    # 生成唯一ID和文件名
    invoice_id = str(uuid.uuid4())
    file_ext = file.filename.rsplit('.', 1)[1].lower()
    original_filename = file.filename  # 保留原始文件名，不进行 secure_filename 处理
    stored_filename = f"{invoice_id}.{file_ext}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], stored_filename)
    
    file.save(file_path)
    
    # 保存到数据库
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    now = datetime.now().isoformat()
    c.execute('''
        INSERT INTO invoices (id, filename, original_filename, file_path, file_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (invoice_id, stored_filename, original_filename, file_path, file_ext, 'pending', now, now))
    conn.commit()
    conn.close()
    
    return jsonify({
        'id': invoice_id,
        'filename': original_filename,
        'status': 'pending'
    }), 201

@app.route('/api/invoices/<invoice_id>', methods=['PUT'])
def update_invoice(invoice_id):
    """更新发票信息"""
    data = request.json
    
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    
    # 检查发票是否存在
    c.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Invoice not found'}), 404
    
    # 更新字段
    update_fields = []
    values = []
    
    if 'category' in data:
        update_fields.append('category = ?')
        values.append(data['category'])
    
    if 'amount' in data:
        update_fields.append('amount = ?')
        values.append(data['amount'])
    
    if 'attachments' in data:
        update_fields.append('attachments = ?')
        values.append(json.dumps(data['attachments']) if data['attachments'] else None)
    
    if 'notes' in data:
        update_fields.append('notes = ?')
        values.append(data['notes'])
    
    if 'status' in data:
        update_fields.append('status = ?')
        values.append(data['status'])
    
    update_fields.append('updated_at = ?')
    values.append(datetime.now().isoformat())
    values.append(invoice_id)
    
    query = f"UPDATE invoices SET {', '.join(update_fields)} WHERE id = ?"
    c.execute(query, values)
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Invoice updated successfully'})

@app.route('/api/invoices/<invoice_id>', methods=['DELETE'])
def delete_invoice(invoice_id):
    """删除发票"""
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    
    # 获取文件路径
    c.execute('SELECT file_path FROM invoices WHERE id = ?', (invoice_id,))
    result = c.fetchone()
    
    if not result:
        conn.close()
        return jsonify({'error': 'Invoice not found'}), 404
    
    # 删除文件
    file_path = result[0]
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # 删除数据库记录
    c.execute('DELETE FROM invoices WHERE id = ?', (invoice_id,))
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Invoice deleted successfully'})

@app.route('/api/invoices/<invoice_id>/file', methods=['GET'])
def get_invoice_file(invoice_id):
    """获取发票文件"""
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    c.execute('SELECT file_path, original_filename FROM invoices WHERE id = ?', (invoice_id,))
    result = c.fetchone()
    conn.close()
    
    if not result or not os.path.exists(result[0]):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(result[0], as_attachment=False, download_name=result[1])

def generate_csv_content(categories, attachment_map):
    """生成CSV内容"""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # 写入表头
    writer.writerow(['类别', '文件名', '金额 (RMB)', '附件', '备注', '创建时间'])
    
    total_amount = 0
    
    # 按类别写入数据
    for category, items in sorted(categories.items()):
        category_total = 0
        for invoice in items:
            amount = invoice.get('amount') or 0
            category_total += amount
            total_amount += amount
            
            invoice_id = invoice.get('id')
            
            # 获取手动填写的附件名称
            attachment_names = []
            attachments = invoice.get('attachments')
            if attachments:
                try:
                    attachments = json.loads(attachments)
                    if isinstance(attachments, list):
                        attachment_names.extend(attachments)
                    else:
                        attachment_names.append(str(attachments))
                except:
                    attachment_names.append(str(attachments))
            
            # 获取通过"作为附件"功能关联的实际附件文件
            if invoice_id in attachment_map:
                attachment_files = attachment_map[invoice_id]
                # 将附件文件名添加到列表中
                attachment_names.extend(attachment_files)
            
            # 合并所有附件信息
            attachments_str = ', '.join(attachment_names) if attachment_names else ''
            
            writer.writerow([
                category,
                invoice.get('original_filename', ''),
                f"{amount:.2f}",
                attachments_str,
                invoice.get('notes', ''),
                invoice.get('created_at', '')
            ])
        
        # 写入类别小计
        writer.writerow([f'{category} 小计', '', f"{category_total:.2f}", '', '', ''])
        writer.writerow([])  # 空行分隔
    
    # 写入总计
    writer.writerow(['总计', '', f"{total_amount:.2f}", '', '', ''])
    
    output.seek(0)
    return output.getvalue()

@app.route('/api/invoices/export', methods=['GET'])
def export_invoices():
    """导出发票为CSV"""
    format_type = request.args.get('format', 'csv')  # csv or excel
    
    conn = sqlite3.connect('database/invoices.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM invoices WHERE status = 'completed' ORDER BY category, created_at")
    invoices = [dict(row) for row in c.fetchall()]
    
    # 获取所有发票的附件关系映射（invoice_id -> [attachment_filenames]）
    attachment_map = {}
    invoice_ids = [inv['id'] for inv in invoices]
    if invoice_ids:
        # 使用参数化查询，避免SQL注入
        placeholders = ','.join(['?'] * len(invoice_ids))
        c.execute(f'''
            SELECT ia.invoice_id, i.original_filename
            FROM invoice_attachments ia
            INNER JOIN invoices i ON ia.attachment_id = i.id
            WHERE ia.invoice_id IN ({placeholders})
            ORDER BY ia.created_at
        ''', invoice_ids)
        
        for row in c.fetchall():
            invoice_id = row[0]
            attachment_filename = row[1]
            if invoice_id not in attachment_map:
                attachment_map[invoice_id] = []
            attachment_map[invoice_id].append(attachment_filename)
    
    conn.close()
    
    if not invoices:
        return jsonify({'error': 'No completed invoices to export'}), 404
    
    # 按类别分组
    categories = {}
    for invoice in invoices:
        category = invoice.get('category', '未分类')
        if category not in categories:
            categories[category] = []
        categories[category].append(invoice)
    
    # 生成CSV内容（目前excel格式也返回CSV，可以后续扩展为真正的Excel）
    csv_content = generate_csv_content(categories, attachment_map)
    
    return send_file(
        io.BytesIO(csv_content.encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'invoices_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )

# 附件关系相关API
@app.route('/api/invoices/attachments/all', methods=['GET'])
def get_all_attachment_ids():
    """获取所有被指定为附件的发票ID列表"""
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    
    # 获取所有被指定为附件的发票ID
    c.execute('SELECT DISTINCT attachment_id FROM invoice_attachments')
    attachment_ids = [row[0] for row in c.fetchall()]
    
    conn.close()
    
    return jsonify({'attachment_ids': attachment_ids})

@app.route('/api/invoices/<invoice_id>/attachments', methods=['GET'])
def get_invoice_attachments(invoice_id):
    """获取发票的附件列表"""
    conn = sqlite3.connect('database/invoices.db')
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # 获取作为附件的文件列表
    c.execute('''
        SELECT i.*, ia.created_at as attached_at
        FROM invoices i
        INNER JOIN invoice_attachments ia ON i.id = ia.attachment_id
        WHERE ia.invoice_id = ?
        ORDER BY ia.created_at DESC
    ''', (invoice_id,))
    attachments = [dict(row) for row in c.fetchall()]
    
    # 获取当前文件作为附件被哪些文件引用
    c.execute('''
        SELECT i.*, ia.created_at as attached_at
        FROM invoices i
        INNER JOIN invoice_attachments ia ON i.id = ia.invoice_id
        WHERE ia.attachment_id = ?
        ORDER BY ia.created_at DESC
    ''', (invoice_id,))
    attached_to = [dict(row) for row in c.fetchall()]
    
    conn.close()
    
    return jsonify({
        'attachments': attachments,  # 当前文件的附件列表
        'attached_to': attached_to   # 当前文件作为附件被哪些文件引用
    })

@app.route('/api/invoices/<invoice_id>/attachments', methods=['POST'])
def add_invoice_attachment(invoice_id):
    """将文件添加为发票的附件"""
    data = request.json
    attachment_id = data.get('attachment_id')
    
    if not attachment_id:
        return jsonify({'error': 'attachment_id is required'}), 400
    
    if invoice_id == attachment_id:
        return jsonify({'error': 'Cannot attach file to itself'}), 400
    
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    
    # 检查两个文件是否存在
    c.execute('SELECT id FROM invoices WHERE id = ?', (invoice_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Invoice not found'}), 404
    
    c.execute('SELECT id FROM invoices WHERE id = ?', (attachment_id,))
    if not c.fetchone():
        conn.close()
        return jsonify({'error': 'Attachment file not found'}), 404
    
    # 检查是否已经存在
    c.execute('SELECT id FROM invoice_attachments WHERE invoice_id = ? AND attachment_id = ?', 
              (invoice_id, attachment_id))
    if c.fetchone():
        conn.close()
        return jsonify({'error': 'Attachment already exists'}), 400
    
    # 添加附件关系
    attachment_rel_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    c.execute('''
        INSERT INTO invoice_attachments (id, invoice_id, attachment_id, created_at)
        VALUES (?, ?, ?, ?)
    ''', (attachment_rel_id, invoice_id, attachment_id, now))
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Attachment added successfully'}), 201

@app.route('/api/invoices/<invoice_id>/attachments/<attachment_id>', methods=['DELETE'])
def remove_invoice_attachment(invoice_id, attachment_id):
    """移除发票的附件"""
    conn = sqlite3.connect('database/invoices.db')
    c = conn.cursor()
    
    c.execute('DELETE FROM invoice_attachments WHERE invoice_id = ? AND attachment_id = ?',
              (invoice_id, attachment_id))
    
    if c.rowcount == 0:
        conn.close()
        return jsonify({'error': 'Attachment not found'}), 404
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Attachment removed successfully'})

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)

