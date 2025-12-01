const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

// 允许跨域请求
app.use(cors());
app.use(express.json()); // 允许解析 JSON body

// 存储所有连接的客户端（用于广播场景）
const clients = new Set();

// 基础SSE端点（修复心跳逻辑）
app.get("/sse", (req, res) => {
  // 设置SSE必需的响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // 发送初始连接成功消息
  res.write('data: {"message": "连接成功"}\n\n');
  console.log("客户端已连接");
  // 将客户端响应对象保存起来
  clients.add(res);

  // 心跳发送：每30秒发送注释行作为心跳（浏览器不会触发 new message）
  const heartbeatInterval = setInterval(() => {
    try {
      res.write("heartbeat:\n\n"); // SSE注释行作为心跳
    } catch (e) {
      // 忽略写入错误
    }
  }, 30000); // 每30秒发送一次心跳

  // 客户端断开连接时清理
  req.on("close", () => {
    clients.delete(res);
    clearInterval(heartbeatInterval);
    console.log("客户端断开连接");
    try {
      res.end();
    } catch (e) {}
  });
});

app.get("/stream-text", (req, res) => {
  // 设置SSE响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  const messages = [
    "欢迎学习SSE技术！",
    "这是一种服务器向客户端推送数据的技术。",
    "可以实现实时更新、通知、日志流等功能。",
    "现在你看到的是逐字输出的流式效果。",
    "这只是一个简单的示例。",
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
        done: false,
      };
      res.write(`data: ${JSON.stringify(message)}\n\n`);
      // 移动到下一个字符
      charIndex++;

      // 控制发送速度（每50毫秒一个字符）
      setTimeout(sendNextCharacter, 50);
    } else {
      // 当前消息结束，发送换行
      res.write('data: {"char": "\\n", "done": false}\n\n');
      // 切换到下一条消息
      messageIndex++;
      charIndex = 0;

      // 消息间暂停
      setTimeout(sendNextCharacter, 200);
    }
  };

  // 开始发送
  sendNextCharacter();

  // 处理连接断开
  req.on("close", () => {
    res.end();
  });
});

app.get("/sse-data", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // 设置重连时间（毫秒）
  res.write("retry: 5000\n\n");

  let count = 0;
  // 每2秒发送一次数据
  const interval = setInterval(() => {
    // 构造基础的数据对象 
    count++;
    console.log(`发送事件 #${count}`);
    const data = {
      id: count,
      timestamp: new Date().toISOString(),
      type: "update",
    };

    // 发送不同类型的事件
    if (count % 3 === 0 && count !== 1) {
      /*当服务器发送event: status   data: {...}\n\n时，浏览器的 EventSource 会把它识别为一个自定义事件名为 "status" 的事件。*/
      // 前端通过 addEventListener('status', handler) 或 es.onstatus（非标准）来接收；没有 event: 行的消息走默认的 onmessage。
      res.write("event: status\n");
      res.write(`data: ${JSON.stringify({ ...data, status: "pause" })}\n\n`);
    } else {
      if (count === 1) {
        console.log("发送初始化事件");
        res.write("event: status\n");
        res.write(`data: ${JSON.stringify({ ...data, status: "connected" })}\n\n`);
      } else {
        res.write(
          `data: ${JSON.stringify({ ...data, value: Math.random() * 100 })}\n\n`
        );
      }
    }

    // 发送10次后结束
    if (count >= 20) {
      clearInterval(interval);
      res.write("event: status\n");
      res.write(`data: ${JSON.stringify({ ...data, status: "done" })}\n\n`);
      res.end();
    }
  },1000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

// 新增：立即触发所有连接心跳或简短广播（GET 用于测试）
// 可用 /send-heartbeat?msg=hello 来广播简短消息；不带 msg 则仅发送注释心跳
app.get("/send-heartbeat", (req, res) => {
  const msg = req.query.msg;
  let removed = 0;

  clients.forEach((client) => {
    try {
      if (msg) {
        // 以 event: heartbeat 发送简短消息
        client.write("event: heartbeat\n");
        client.write(
          `data: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            msg,
          })}\n\n`
        );
      } else {
        // 发送注释心跳
        client.write(":\n\n");
      }
    } catch (e) {
      // 如果发送失败，移除该连接
      try {
        client.end();
      } catch (err) {}
      clients.delete(client);
      removed++;
    }
  });

  res.json({ ok: true, clients: clients.size, removed });
});

// 新增：广播文本到所有连接（示例）
// 使用 /broadcast-text?msg=你好
app.get("/broadcast-text", (req, res) => {
  const msg = req.query.msg || `广播消息 ${new Date().toISOString()}`;
  let sent = 0;
  clients.forEach((client) => {
    try {
      client.write(`event: broadcast\n`);
      client.write(
        `data: ${JSON.stringify({ msg, ts: new Date().toISOString() })}\n\n`
      );
      sent++;
    } catch (e) {
      try {
        client.end();
      } catch (err) {}
      clients.delete(client);
    }
  });
  res.json({ ok: true, sent, clients: clients.size });
});

// 新增示例：动态计数器（单连接流式示例）
app.get("/dynamic-counter", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  let i = 0;
  const t = setInterval(() => {
    res.write(
      `data: ${JSON.stringify({
        counter: i,
        ts: new Date().toISOString(),
      })}\n\n`
    );
    i++;
    if (i > 30) {
      // 例如发送 30 次后结束
      clearInterval(t);
      res.write('data: {"done": true}\n\n');
      res.end();
    }
  }, 1000);

  req.on("close", () => {
    clearInterval(t);
    try {
      res.end();
    } catch (e) {}
  });
});

// 新增示例：JSON 动态更新流（随机值）
app.get("/stream-json", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  let id = 0;
  const interval = setInterval(() => {
    const payload = {
      id: id++,
      value: Math.round(Math.random() * 1000) / 10,
      status: id % 7 === 0 ? "alert" : "ok",
      ts: new Date().toISOString(),
    };
    // 以 event 类型区分重要告警
    if (payload.status === "alert") {
      res.write("event: alert\n");
    }
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

    if (id >= 50) {
      clearInterval(interval);
      res.end();
    }
  }, 1500);

  req.on("close", () => {
    clearInterval(interval);
    try {
      res.end();
    } catch (e) {}
  });
});

app.listen(PORT, () => {
  console.log(`SSE服务器运行在 http://localhost:${PORT}`);
});
