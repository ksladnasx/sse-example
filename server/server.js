const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// 允许跨域请求
app.use(cors());

// 存储所有连接的客户端（用于广播场景）
const clients = new Set();

// 基础SSE端点
app.get('/sse', (req, res) => {
  // 设置SSE必需的响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // 发送初始连接成功消息
  res.write('data: {"message": "连接成功"}\n\n');
  
  // 将客户端响应对象保存起来
  clients.add(res);
  // 心跳发送
  
  
  // 客户端断开连接时清理
  req.on('close', () => {
    clients.delete(res);
    console.log('客户端断开连接');
    res.end();
  });
});


app.get('/stream-text', (req, res) => {
  // 设置SSE响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  const messages = [
    "欢迎学习SSE技术！",
    "这是一种服务器向客户端推送数据的技术。",
    "可以实现实时更新、通知、日志流等功能。",
    "现在你看到的是逐字输出的流式效果。"
  ];
  
  let messageIndex = 0;
  let charIndex = 0;
  
  const sendNextCharacter = () => {
    if (messageIndex >= messages.length) {
      // 所有消息发送完毕
      res.write('data: {"done": true}\n\n');
      res.end();
      return;
    }
    
    const currentMessage = messages[messageIndex];
    
    if (charIndex < currentMessage.length) {
      // 发送单个字符
      const char = currentMessage[charIndex];
      const message = {
        char: char,
        messageIndex: messageIndex,
        charIndex: charIndex,
        done: false
      };
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      charIndex++;
      
      // 控制发送速度（每50毫秒一个字符）
      setTimeout(sendNextCharacter, 50);
    } else {
      // 当前消息结束，发送换行
      res.write('data: {"char": "\\n", "done": false}\n\n');
      messageIndex++;
      charIndex = 0;
      
      // 消息间暂停
      setTimeout(sendNextCharacter, 200);
    }
  };
  
  // 开始发送
  sendNextCharacter();
  
  // 处理连接断开
  req.on('close', () => {
    res.end();
  });
});

app.get('/sse-data', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // 设置重连时间（毫秒）
  res.write('retry: 5000\n\n');
  
  let count = 0;
  // 每2秒发送一次数据
  const interval = setInterval(() => {
    const data = {
      id: count,
      timestamp: new Date().toISOString(),
      value: Math.random() * 100,
      type: 'update'
    };
    
    // 发送不同类型的事件
    if (count % 5 === 0) {
      res.write('event: status\n');
      res.write(`data: ${JSON.stringify({...data, status: 'special'})}\n\n`);
    } else {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
    
    count++;
    
    // 发送10次后结束
    if (count >= 10) {
      clearInterval(interval);
      res.write('data: {"done": true}\n\n');
      res.end();
    }
  }, 2000);
  
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

app.listen(PORT, () => {
  console.log(`SSE服务器运行在 http://localhost:${PORT}`);
});