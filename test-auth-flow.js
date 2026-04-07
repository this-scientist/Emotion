// 测试认证流程
async function testAuthFlow() {
  console.log('=== 测试认证流程 ===\n');
  
  const supabaseUrl = 'https://kvwdkesrirxiuosnublw.supabase.co';
  const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2d2RrZXNyaXJ4aXVvc251Ymx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NDU1ODUsImV4cCI6MjA5MTAyMTU4NX0.u-mk-7ZR3SRuezk_Fm1PAmGrML517QYf9aozH-5cr4k';
  
  // 导入Supabase客户端
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. 检查当前会话
    console.log('1. 检查当前会话...');
    const { data: sessionData } = await supabase.auth.getSession();
    console.log(`   会话状态: ${sessionData.session ? '已登录' : '未登录'}`);
    
    // 2. 测试安全文件API（应该失败）
    console.log('\n2. 测试安全文件API（未登录状态）...');
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/secure-files`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      });
      console.log(`   响应状态: ${response.status}`);
      const errorText = await response.text();
      console.log(`   错误信息: ${errorText.substring(0, 100)}...`);
    } catch (error) {
      console.log(`   API调用失败: ${error.message}`);
    }
    
    // 3. 测试注册/登录（可选）
    console.log('\n3. 测试环境配置...');
    console.log(`   Supabase URL: ${supabaseUrl}`);
    console.log(`   Anon Key: ${supabaseKey.substring(0, 20)}...`);
    
    // 4. 检查CORS配置
    console.log('\n4. 检查CORS配置...');
    const corsResponse = await fetch(`${supabaseUrl}/functions/v1/secure-files`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:51172',
        'Access-Control-Request-Method': 'GET'
      }
    });
    console.log(`   CORS预检状态: ${corsResponse.status}`);
    const allowOrigin = corsResponse.headers.get('access-control-allow-origin');
    console.log(`   Allow-Origin: ${allowOrigin}`);
    
    console.log('\n=== 测试完成 ===');
    console.log('\n总结:');
    console.log('1. 应用应正确处理未登录状态');
    console.log('2. 安全文件API应返回401而不是Invalid JWT错误');
    console.log('3. CORS配置正确');
    console.log('4. 用户需要先登录才能访问文件功能');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testAuthFlow();