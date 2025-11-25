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

const outputText = ref('');
const isConnected = ref(false);
const isStreaming = ref(false);
const messageCount = ref(0);
const connectionStatus = ref('未连接');
const messages = ref([]);
const outputElement = ref(null);
const eventSource = ref(null);

// 连接基础SSE端点
const connectSSE = () => {
  if (eventSource.value) {
    return;
  }
  
  try {
    eventSource.value = new EventSource('http://localhost:3000/sse');
    
    eventSource.value.onopen = () => {
      isConnected.value = true;
      connectionStatus.value = '已连接';
      console.log('SSE连接已建立');
    };
    
    eventSource.value.onmessage = (event) => {
      messageCount.value++;
      const data = JSON.parse(event.data);
      messages.value.push(data.message || data);
      
      // 保持消息列表不超过20条
      if (messages.value.length > 20) {
        messages.value.shift();
      }
    };
    
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
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
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
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
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