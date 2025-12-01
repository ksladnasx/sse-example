<template>
  <div class="sse-demo">
    <h1>SSE 流式文本演示</h1>

    <div class="controls">
      <button @click="connectSSE" :disabled="isConnected">
        连接SSE
      </button>
      <button @click="startStream" :disabled="isStreaming">
        {{ isStreaming ? '流式传输中...' : '开始流式文本' }}
      </button>
      <button @click="disconnectSSE" :disabled="!isConnected">
        断开连接
      </button>
    </div>

    <div class="stream-container">
      <div class="output" ref="outputElement">
        {{ outputText }}
        <span class="cursor" v-if="isStreaming">|</span>
      </div>
    </div>

    <div class="status">
      <p>连接状态: {{ connectionStatus }}</p>
      <p>接收消息数: {{ messageCount }}</p>
      <p>event:{{ statusevent == null ? "暂无" : statusevent }}</p>
    </div>

    <div class="messages" v-if="messages.length > 0">
      <h3>实时消息:</h3>
      <ul>
        <li v-for="(msg, index) in messages" :key="index">
          {{ msg }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onUnmounted, nextTick } from 'vue';
const outputText = ref(''); // 流式输出文本
const isConnected = ref(false); // SSE连接状态
const statusevent = ref(null);  // SSE实例状态
const isStreaming = ref(false); // 流式传输状态
const messageCount = ref(0);  // 接收的消息计数
const connectionStatus = ref('未连接'); // 连接状态文本
const messages = ref([]); //消息队列
const outputElement = ref(null); // 输出文本容器引用
const eventSource = ref(null);  // SSE实例
// 格式化日期为标准字符串
function formatDateToStandard(date, useUTC = false) {
  const getter = useUTC ? 'getUTC' : 'get';
  const year = date[getter + 'FullYear']();
  const month = String(date[getter + 'Month']() + 1).padStart(2, '0'); // 月份0-11，需+1
  const day = String(date[getter + 'Date']()).padStart(2, '0');
  const hours = String(date[getter + 'Hours']()).padStart(2, '0');
  const minutes = String(date[getter + 'Minutes']()).padStart(2, '0');
  const seconds = String(date[getter + 'Seconds']()).padStart(2, '0');

  return `${year}年${month}月${day}日 ${hours}:${minutes}:${seconds}`;
}

// 连接基础SSE端点
const connectSSE = () => {
  if (eventSource.value) {
    return;
  }
  try {
    // 创建新的EventSource实例
    eventSource.value = new EventSource('http://localhost:3000/sse-data');

    // 连接建立回调
    eventSource.value.onopen = () => {
      isConnected.value = true;
      connectionStatus.value = '已连接';
      messages.value.unshift("消息开始");
      console.log('SSE连接已建立');
    };

    // 接收消息回调
    eventSource.value.onmessage = (event) => {
      // 后端发送的普通消息会触发这里，没有 event: 行。则statusevent为receving
      statusevent.value = 'receving';
      // console.log('接收到消息:', event);
      const data = JSON.parse(event.data);
      messageCount.value++;
      messages.value.unshift(`消息值：${data.value}  ，时间：${formatDateToStandard(new Date(data.timestamp))}` || data);
      // 保持消息列表不超过20条
      if (messages.value.length > 20) {
        messages.value.shift();
      }
    };

    // 接收自定义 event: status
    eventSource.value.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      // e.data 同样是服务器发送的字符串
      statusevent.value = data.status;
      if (data.status === 'done') {
        connectionStatus.value = '服务器已完成发送';
        messages.value.unshift("消息结束");
        //关闭sse连接
        disconnectSSE();
      }
    });
    // 错误回调
    eventSource.value.onerror = (error) => {
      console.error('SSE错误:', error);
      connectionStatus.value = '连接错误';
      isConnected.value = false;
    };

  } catch (error) {
    console.error('创建SSE连接失败:', error);
    connectionStatus.value = '连接失败';
  }
};

// 连接流式文本端点
const startStream = async () => {
  if (isStreaming.value) return;

  try {
    outputText.value = '';
    isStreaming.value = true;

    const response = await fetch('http://localhost:3000/stream-text');
    if (!response.ok || !response.body) {
      throw new Error('流请求失败');
    }

    //将传来 的二进制数据流转换为文本
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    //注意这里是递归  
    const processStream = ({ done, value }) => {
      if (done) {
        isStreaming.value = false;
        return;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));

            if (data.done) {
              isStreaming.value = false;
              return;
            }

            if (data.char === '\n') {
              outputText.value += '\n';
            } else {
              outputText.value += data.char;
            }

            // 自动滚动到底部
            nextTick(() => {
              if (outputElement.value) {
                outputElement.value.scrollTop = outputElement.value.scrollHeight;
              }
            });
          } catch (e) {
            console.error('解析消息错误:', e);
          }
        }
      }

      return reader.read().then(processStream);
    };
    reader.read().then(processStream);

  } catch (error) {
    console.error('流式请求错误:', error);
    isStreaming.value = false;
  }
};

// 断开连接
const disconnectSSE = () => {
  if (eventSource.value) {
    eventSource.value.close();
    eventSource.value = null;
  }
  isConnected.value = false;
  isStreaming.value = false;
  connectionStatus.value = '已断开';
};

// 组件卸载时清理连接
onUnmounted(() => {
  disconnectSSE();
});
</script>

<style scoped>
.sse-demo {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.controls {
  margin: 20px 0;
}

button {
  padding: 10px 15px;
  margin-right: 10px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.stream-container {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 15px;
  height: 200px;
  overflow-y: auto;
  margin-bottom: 20px;
  background-color: #f9f9f9;
}

.output {
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.5;
  min-height: 100%;
  font-family: 'Courier New', monospace;
}

.cursor {
  animation: blink 1s infinite;
}

@keyframes blink {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

.status {
  background-color: #f0f0f0;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 20px;
}

.messages {
  border-top: 1px solid #ddd;
  padding-top: 20px;
}

.messages ul {
  list-style-type: none;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
}

.messages li {
  background: #f0f0f0;
  margin: 5px 0;
  padding: 8px;
  border-radius: 4px;
}
</style>