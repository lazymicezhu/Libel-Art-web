document.addEventListener('DOMContentLoaded', () => {
    const chatBox = document.getElementById('chat-box');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const restartBtn = document.getElementById('restart-btn');
    const currentRoundSpan = document.getElementById('current-round');
    
    const API_BASE_URL = 'https://api.lazymicezhu.com';
    const API_KEY = 'sk-IoiTqFx9LAbqti5b752e84499f30443bB5198aBe5dBbC6C9';
    
    let conversationHistory = [];
    let currentRound = 0;
    const MAX_ROUNDS = 5;
    let isChatCompleted = false;
    let isResultShown = false;
    
    // 系统角色和初始提示
    const systemPrompt = `你是一位严格、尖酸刻薄的面试官，对文科生有明显的偏见。你认为文科生没有实际技能，只会空谈理论。面试者是一名文科生，试图说服你录用他/她。
    
    你的特点：
    - 对文科生持怀疑态度，认为他们不如理工科生实用
    - 提出尖锐的问题，挑战应聘者
    - 时刻质疑文科背景的实际价值
    - 打断应聘者的长篇大论
    - 语气冷淡而略带讽刺
    
    面试进行5轮问答。在最后一轮后，基于应聘者的表现做出决定是否录用他/她。如果应聘者能清晰展示自己的价值、处理好你的刁难并展示出适合岗位的能力，你可能会改变看法并录用他/她。`;
    
    // 添加消息到聊天框
    function addMessage(content, isUser, isResult = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user-message' : 'ai-message');
        if (isResult) {
            messageDiv.classList.add('result-message');
        }
        messageDiv.textContent = content;
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    // 添加加载指示器
    function addLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('message', 'ai-message');
        loadingDiv.innerHTML = '<span class="loading-dots">思考中</span>';
        loadingDiv.id = 'loading-indicator';
        chatBox.appendChild(loadingDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
    }
    
    // 移除加载指示器
    function removeLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    // 检查并显示最终结果
    function checkAndDisplayFinalResult(aiReply) {
        if (aiReply.includes('【录用结果】')) {
            // 正常情况：回复中包含录用结果标记
            const parts = aiReply.split('【录用结果】');
            const normalReply = parts[0].trim();
            let resultPart = parts[1].trim();
            
            // 确保结果部分包含明确的"录用"或"不录用"关键词
            if (!resultPart.includes('录用') && !resultPart.includes('不录用')) {
                // 如果没有明确结果，强制添加一个
                resultPart = "结果不明确，请点击'重新开始'再次尝试。";
            }
            
            if (normalReply) {
                addMessage(normalReply, false);
                
                // 保存正常回复到历史
                conversationHistory.push({
                    role: 'assistant',
                    content: normalReply
                });
            }
            
            // 等待一秒后显示结果信息
            setTimeout(() => {
                addMessage(`【录用结果】${resultPart}`, false, true);
                isResultShown = true;
                
                // 添加重新开始提示
                setTimeout(() => {
                    addMessage('面试已结束。点击"重新开始"可以重新面试。', false);
                }, 1000);
            }, 1000);
            
            return true;
        } else {
            // 未找到结果标记，尝试解析是否有录用相关内容
            if (aiReply.includes('录用') || aiReply.includes('不录用')) {
                // 保存原始回复
                addMessage(aiReply, false);
                conversationHistory.push({
                    role: 'assistant',
                    content: aiReply
                });
                
                // 提取结果并显示
                let resultMessage = "";
                if (aiReply.includes('不录用')) {
                    resultMessage = "不录用。" + extractReason(aiReply);
                } else if (aiReply.includes('录用')) {
                    resultMessage = "录用。" + extractReason(aiReply);
                }
                
                // 等待一秒后显示结果信息
                setTimeout(() => {
                    addMessage(`【录用结果】${resultMessage}`, false, true);
                    isResultShown = true;
                    
                    // 添加重新开始提示
                    setTimeout(() => {
                        addMessage('面试已结束。点击"重新开始"可以重新面试。', false);
                    }, 1000);
                }, 1000);
                
                return true;
            }
            
            return false;
        }
    }
    
    // 从回复中提取原因
    function extractReason(text) {
        // 简单提取可能的原因解释
        const sentences = text.split(/[.!?。！？]/);
        for (let sentence of sentences) {
            if (sentence.includes('因为') || sentence.includes('理由') || 
                sentence.includes('原因') || sentence.includes('考虑')) {
                return sentence.trim();
            }
        }
        return "请考虑您的表现和回答质量。";
    }
    
    // 发送消息到OpenAI API
    async function sendMessageToAPI(message, isFinalEvaluation = false) {
        try {
            let promptToUse = systemPrompt;
            
            if (isFinalEvaluation) {
                promptToUse = `${systemPrompt}\n\n现在面试已经结束，请你做出最终决定：是否录用这位文科生应聘者？这是一个非常重要的决定，你必须明确地做出选择。\n\n你的回复必须包含以下内容：\n1. 以"【录用结果】"开头\n2. 明确说明"录用"或"不录用"（必须包含这两个词中的一个）\n3. 给出简短的理由\n\n例如："【录用结果】录用。尽管你是文科生，但你展示了良好的沟通能力和解决问题的能力。"\n或者："【录用结果】不录用。你未能展示出足够的专业能力和解决实际问题的思维。"`;
            }
            
            const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4.1-nano',
                    messages: [
                        {
                            role: 'system',
                            content: promptToUse
                        },
                        ...conversationHistory,
                        {
                            role: 'user',
                            content: message
                        }
                    ],
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                throw new Error(`API响应错误: ${response.status}`);
            }
            
            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('API请求错误:', error);
            return '抱歉，连接面试官时出现问题。请稍后再试。';
        }
    }
    
    // 处理发送消息
    async function handleSendMessage() {
        const userMessage = userInput.value.trim();
        if (userMessage === '' || isChatCompleted) return;
        
        addMessage(userMessage, true);
        userInput.value = '';
        
        // 保存用户消息到历史
        conversationHistory.push({
            role: 'user',
            content: userMessage
        });
        
        addLoadingIndicator();
        
        // 更新轮数
        currentRound++;
        currentRoundSpan.textContent = currentRound;
        
        // 获取AI回复
        let aiReply;
        if (currentRound >= MAX_ROUNDS) {
            // 最后一轮，获取最终决定
            aiReply = await sendMessageToAPI(userMessage, true);
            isChatCompleted = true;
            userInput.disabled = true;
            sendBtn.disabled = true;
            
            removeLoadingIndicator();
            
            // 处理并显示最终结果
            const isResultDisplayed = checkAndDisplayFinalResult(aiReply);
            
            // 如果没有找到结果或格式不符合预期，显示默认结果
            if (!isResultDisplayed) {
                addMessage(aiReply, false);
                
                // 保存AI回复到历史
                conversationHistory.push({
                    role: 'assistant',
                    content: aiReply
                });
                
                // 显示一个默认的结果消息
                setTimeout(() => {
                    const defaultResult = Math.random() > 0.5 ? 
                        "录用。尽管我对文科生有保留意见，但你的表现令人印象深刻。" : 
                        "不录用。你未能充分展示文科背景如何为我们的团队带来价值。";
                    
                    addMessage(`【录用结果】${defaultResult}`, false, true);
                    isResultShown = true;
                    
                    setTimeout(() => {
                        addMessage('面试已结束。点击"重新开始"可以重新面试。', false);
                    }, 1000);
                }, 1000);
            }
        } else {
            // 普通轮次
            aiReply = await sendMessageToAPI(userMessage);
            removeLoadingIndicator();
            addMessage(aiReply, false);
            
            // 保存AI回复到历史
            conversationHistory.push({
                role: 'assistant',
                content: aiReply
            });
        }
    }
    
    // 重置对话
    function resetChat() {
        chatBox.innerHTML = '';
        conversationHistory = [];
        currentRound = 0;
        currentRoundSpan.textContent = currentRound;
        isChatCompleted = false;
        isResultShown = false;
        userInput.disabled = false;
        sendBtn.disabled = false;
        
        // 添加面试官的第一条消息
        startInterview();
    }
    
    // 开始面试
    async function startInterview() {
        addLoadingIndicator();
        
        // 获取面试官的第一条消息
        const initialPrompt = "你好，我是今天的面试官。我看到你是文科背景，这让我有些疑虑。请简单介绍一下你自己，以及为什么我们应该考虑一个文科生来填补这个职位？";
        removeLoadingIndicator();
        addMessage(initialPrompt, false);
        
        // 保存初始消息到历史
        conversationHistory.push({
            role: 'assistant',
            content: initialPrompt
        });
    }
    
    // 事件监听器
    sendBtn.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    restartBtn.addEventListener('click', resetChat);
    
    // 初始化面试
    resetChat();
}); 