import type { APIRoute } from 'astro';

const BACKEND_BASE = 'http://39.96.200.9:8000';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { taskId } = params;
    
    if (!taskId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Task ID is required' 
        }), 
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }
    
    // 代理请求到后端
    const response = await fetch(`${BACKEND_BASE}/api/crawl/status/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 获取后端响应
    const data = await response.text();
    
    // 返回响应，保持相同的状态码和头部
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Status check proxy error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: 'Internal server error' 
      }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}; 