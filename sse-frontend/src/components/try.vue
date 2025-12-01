<template>
  <div></div>
</template>

<script setup>
import { ref } from 'vue';
const eventSource = ref(null)
const isConnected = ref(false);
const connectSSE = ()=>{
    // 如果已经建立了链接就返回
    if (eventSource.value) {
        return;
    }

    try{
        // 创建SSE连接
        eventSource.value = new EventSource('http://localhost:3000/sse');
        // 根据不同的事件类型设置处理函数
        eventSource.value.onopen = ()=>{
            isConnected.value = true;
            console.log('SSE连接已建立');
        }
        
        eventSource.value.onmessage = (event)=>{
            console.log('收到消息:', event.data);
        }

        eventSource.value.onerror = (error)=>{
            console.error('SSE错误:', error);
        }
    }catch(error){
        console.error('创建SSE连接失败:', error);
    }
}


</script>

<style scoped>

</style>