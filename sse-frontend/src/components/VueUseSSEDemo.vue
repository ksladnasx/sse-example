<template>
  <div>
    <h2>使用VueUse的SSE实现</h2>
    <div>状态: {{ status }}</div>
    <div>最新数据: {{ lastData }}</div>
  </div>
</template>

<script setup>
import { useEventSource } from '@vueuse/core';

const { status, data, error, close } = useEventSource(
  'http://localhost:3000/sse-data',
  {
    autoReconnect: {
      retries: 3,
      delay: 1000,
      onFailed() {
        console.log('重连失败');
      }
    }
  }
);

const lastData = ref(null);

watch(data, (newData) => {
  if (newData) {
    lastData.value = JSON.parse(newData);
  }
});
</script>