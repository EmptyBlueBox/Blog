import type { APIRoute } from 'astro';

const BACKEND_BASE = 'http://39.96.200.9:8000';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    // 获取完整路径
    const path = params.path || '';
    
    if (!path) {
      return new Response('Path is required', { status: 400 });
    }
    
    // 构建后端下载 URL
    const downloadUrl = `${BACKEND_BASE}/${path}`;
    
    // 代理请求到后端
    const response = await fetch(downloadUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      return new Response('Download failed', { status: response.status });
    }

    // 获取响应头中的内容类型和文件名
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('content-disposition');
    
    // 创建响应头
    const headers = new Headers({
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    
    // 如果有文件名信息，保留它
    if (contentDisposition) {
      headers.set('Content-Disposition', contentDisposition);
    }
    
    // 流式传输文件内容
    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}; 