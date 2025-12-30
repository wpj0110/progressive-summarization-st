/* global SillyTavern */
import React, { useState, useEffect } from 'react';

function App() {
    // State management (similar to Angular component properties)
    const [tokenThreshold, setTokenThreshold] = useState(1000);
    const [isEnabled, setIsEnabled] = useState(false);
    const [currentTokenCount, setCurrentTokenCount] = useState(0);
    const [summaries, setSummaries] = useState([]);
    const [summarizedMessageIds, setSummarizedMessageIds] = useState(new Set());
    const [status, setStatus] = useState('Ready');

    // Helper function to get current chat ID
    const getCurrentChatId = () => {
        const context = SillyTavern.getContext();
        if (typeof context.getCurrentChatId === 'function') {
            return context.getCurrentChatId();
        }
        return null;
    };
    
    // Reload chat data (used by event handlers)
    const reloadChatData = () => {
        console.log('[Progressive Summarization] Reloading chat data...');
        const chatId = getCurrentChatId();
        console.log('[Progressive Summarization] Loading chat data for ID:', chatId);
        
        if (!chatId) {
            console.log('[Progressive Summarization] No chat ID available yet, skipping load');
            setSummaries([]);
            setSummarizedMessageIds(new Set());
            setCurrentTokenCount(0);
            return;
        }
        
        const context = SillyTavern.getContext();
        
        // Load from chatMetadata (per-chat storage)
        const chatData = context.chatMetadata?.progressiveSummarization || {};
        setSummaries(chatData.summaries || []);
        setSummarizedMessageIds(new Set(chatData.summarizedMessageIds || []));
        setCurrentTokenCount(chatData.currentTokenCount || 0);
        
        console.log('[Progressive Summarization] Loaded summaries:', chatData.summaries?.length || 0);
        console.log('[Progressive Summarization] Loaded message IDs:', chatData.summarizedMessageIds?.length || 0);
        
        // Add visual indicators to summarized messages
        setTimeout(addSummarizedIndicators, 100);
    };

    // Load settings when component mounts (similar to ngOnInit)
    useEffect(() => {
        console.log('[Progressive Summarization] Component mounted');
        console.log('[Progressive Summarization] window.eventSource available:', !!window.eventSource);
        console.log('[Progressive Summarization] Checking SillyTavern context...');
        
        const context = SillyTavern.getContext();
        console.log('[Progressive Summarization] context.eventSource available:', !!context.eventSource);
        console.log('[Progressive Summarization] context.eventTypes:', context.eventTypes);
        console.log('[Progressive Summarization] context.event_types:', context.event_types);
        
        // Log all available event type keys that might be related to chat changes
        if (context.eventTypes) {
            const chatRelatedEvents = Object.keys(context.eventTypes).filter(key => 
                key.includes('CHAT') || key.includes('CHARACTER') || key.includes('GROUP')
            );
            console.log('[Progressive Summarization] Chat-related events:', chatRelatedEvents);
            console.log('[Progressive Summarization] All event types:', Object.keys(context.eventTypes));
        }
        
        loadSettings();
        loadChatData();
        
        // Register the global prompt interceptor
        registerPromptInterceptor();
        
        // Use eventSource from context if available
        const eventSource = context.eventSource || window.eventSource;
        
        if (eventSource) {
            console.log('[Progressive Summarization] Registering event listeners with eventSource');
            
            eventSource.on('MESSAGE_SENT', handleMessageSent);
            eventSource.on('MESSAGE_RECEIVED', handleMessageReceived);
            eventSource.on('CHARACTER_MESSAGE_RENDERED', addSummarizedIndicators);
            eventSource.on('USER_MESSAGE_RENDERED', addSummarizedIndicators);
            
            // Try using the event type constants from context
            const eventTypes = context.eventTypes || context.event_types;
            if (eventTypes) {
                // CHAT_CHANGED - fires when chat switches
                if (eventTypes.CHAT_CHANGED) {
                    console.log('[Progressive Summarization] Registering CHAT_CHANGED:', eventTypes.CHAT_CHANGED);
                    eventSource.on(eventTypes.CHAT_CHANGED, () => {
                        console.log('[Progressive Summarization] CHAT_CHANGED event fired');
                        setTimeout(() => reloadChatData(), 100);
                    });
                }
                
                // CHARACTER_PAGE_LOADED - fires when character page loads
                if (eventTypes.CHARACTER_PAGE_LOADED) {
                    console.log('[Progressive Summarization] Registering CHARACTER_PAGE_LOADED:', eventTypes.CHARACTER_PAGE_LOADED);
                    eventSource.on(eventTypes.CHARACTER_PAGE_LOADED, () => {
                        console.log('[Progressive Summarization] CHARACTER_PAGE_LOADED event fired');
                        setTimeout(() => reloadChatData(), 100);
                    });
                }
                
                // CHAT_CREATED - fires when a new chat is created
                if (eventTypes.CHAT_CREATED) {
                    console.log('[Progressive Summarization] Registering CHAT_CREATED:', eventTypes.CHAT_CREATED);
                    eventSource.on(eventTypes.CHAT_CREATED, () => {
                        console.log('[Progressive Summarization] CHAT_CREATED event fired');
                        setTimeout(() => reloadChatData(), 100);
                    });
                }
            }
            
            // Cleanup on unmount
            return () => {
                eventSource.removeListener('MESSAGE_SENT', handleMessageSent);
                eventSource.removeListener('MESSAGE_RECEIVED', handleMessageReceived);
                eventSource.removeListener('CHARACTER_MESSAGE_RENDERED', addSummarizedIndicators);
                eventSource.removeListener('USER_MESSAGE_RENDERED', addSummarizedIndicators);
                eventSource.removeListener('CHAT_CHANGED');
                eventSource.removeListener('chatSelected');
                eventSource.removeListener('CHARACTER_SELECTED');
            };
        } else {
            console.warn('[Progressive Summarization] No eventSource found! Events will not work.');
            // Try polling as fallback
            let lastChatId = getCurrentChatId();
            const pollInterval = setInterval(() => {
                const currentChatId = getCurrentChatId();
                if (currentChatId && currentChatId !== lastChatId) {
                    console.log('[Progressive Summarization] Chat changed detected via polling:', lastChatId, '->', currentChatId);
                    lastChatId = currentChatId;
                    reloadChatData();
                }
            }, 1000);
            
            return () => clearInterval(pollInterval);
        }
    }, []);

    // Load settings from extension storage (global settings only)
    const loadSettings = () => {
        const settings = SillyTavern.getContext().extensionSettings?.progressiveSummarization || {};
        setTokenThreshold(settings.tokenThreshold || 1000);
        setIsEnabled(settings.isEnabled || false);
    };

    // Load chat-specific data from chatMetadata
    const loadChatData = () => {
        const chatId = getCurrentChatId();
        
        console.log('[Progressive Summarization] Loading chat data for ID:', chatId);
        
        if (!chatId) {
            console.log('[Progressive Summarization] No chat ID available yet, skipping load');
            setSummaries([]);
            setSummarizedMessageIds(new Set());
            setCurrentTokenCount(0);
            return;
        }
        
        const context = SillyTavern.getContext();
        
        // Load from chatMetadata (per-chat storage)
        const chatData = context.chatMetadata?.progressiveSummarization || {};
        setSummaries(chatData.summaries || []);
        setSummarizedMessageIds(new Set(chatData.summarizedMessageIds || []));
        setCurrentTokenCount(chatData.currentTokenCount || 0);
        
        console.log('[Progressive Summarization] Loaded summaries:', chatData.summaries?.length || 0);
        console.log('[Progressive Summarization] Loaded message IDs:', chatData.summarizedMessageIds?.length || 0);
        
        // Add visual indicators to summarized messages
        setTimeout(addSummarizedIndicators, 100);
        // Add visual indicators to summarized messages
        setTimeout(addSummarizedIndicators, 100);
    };

    // Save settings to extension storage
    const saveSettings = async () => {
        const context = SillyTavern.getContext();
        
        // Save global settings
        if (!context.extensionSettings) {
            context.extensionSettings = {};
        }
        if (!context.extensionSettings.progressiveSummarization) {
            context.extensionSettings.progressiveSummarization = {};
        }
        
        context.extensionSettings.progressiveSummarization = {
            tokenThreshold,
            isEnabled,
        };
        
        const { saveSettingsDebounced } = SillyTavern.getContext();
        saveSettingsDebounced();
        
        // Save chat-specific data to chatMetadata
        await saveChatData();
        
        setStatus('Settings saved');
        setTimeout(() => setStatus('Ready'), 2000);
    };

    // Save chat-specific data to chatMetadata
    const saveChatData = async (dataOverride = null) => {
        const chatId = getCurrentChatId();
        
        console.log('[Progressive Summarization] Saving chat data for ID:', chatId);
        
        if (!chatId) {
            console.log('[Progressive Summarization] No chat ID available, skipping save');
            return;
        }
        
        const context = SillyTavern.getContext();
        
        if (!context.chatMetadata) {
            context.chatMetadata = {};
        }
        
        // Use provided data or current state
        const dataToSave = dataOverride || {
            summaries: summaries,
            summarizedMessageIds: Array.from(summarizedMessageIds),
            currentTokenCount: currentTokenCount
        };
        
        console.log('[Progressive Summarization] Saving summaries:', dataToSave.summaries.length);
        console.log('[Progressive Summarization] Saving message IDs:', dataToSave.summarizedMessageIds.length);
        
        // Save to chatMetadata (per-chat storage)
        context.chatMetadata.progressiveSummarization = dataToSave;
        
        const { saveMetadata } = SillyTavern.getContext();
        if (saveMetadata) {
            await saveMetadata();
            console.log('[Progressive Summarization] Saved successfully');
        }
    };

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimateTokens = (text) => {
        return Math.ceil(text.length / 4);
    };

    // Register the prompt interceptor to filter out summarized messages
    const registerPromptInterceptor = () => {
        // Define the interceptor function globally
        globalThis.progressiveSummarizationInterceptor = async (chat, contextSize, abort, type) => {
            // Only intercept if extension is enabled
            const context = SillyTavern.getContext();
            const settings = context.extensionSettings?.progressiveSummarization;
            if (!settings?.isEnabled) return;
            
            // Get chat-specific data from chatMetadata
            const chatData = context.chatMetadata?.progressiveSummarization;
            if (!chatData) return;
            
            const summarizedIds = new Set(chatData.summarizedMessageIds || []);
            
            // If we have summaries, filter out summarized messages
            if (summarizedIds.size > 0 && chatData.summaries?.length > 0) {
                // Remove summarized messages from the chat array
                const originalLength = chat.length;
                
                // Filter in reverse to maintain array integrity
                for (let i = chat.length - 1; i >= 0; i--) {
                    if (chat[i]?.id && summarizedIds.has(chat[i].id)) {
                        chat.splice(i, 1);
                    }
                }
                
                const removedCount = originalLength - chat.length;
                
                // Inject summaries at the beginning
                if (chatData.summaries.length > 0 && chat.length > 0) {
                    // Create a system message with all summaries
                    const summaryText = chatData.summaries
                        .map((s, i) => `[Summary ${i + 1}]: ${s.text}`)
                        .join('\n\n');
                    
                    const summaryMessage = {
                        is_user: false,
                        is_system: true,
                        name: 'Conversation Summary',
                        mes: summaryText,
                        send_date: Date.now(),
                        extra: {
                            type: 'narrator',
                        }
                    };
                    
                    // Insert at the beginning (after any existing system messages)
                    let insertIndex = 0;
                    while (insertIndex < chat.length && chat[insertIndex]?.is_system) {
                        insertIndex++;
                    }
                    chat.splice(insertIndex, 0, summaryMessage);
                }
                
                console.log(`[Progressive Summarization] Filtered ${removedCount} summarized messages, injected ${chatData.summaries.length} summaries`);
            }
        };
    };

    // Add visual indicators to summarized messages
    const addSummarizedIndicators = () => {
        console.log('[Progressive Summarization] addSummarizedIndicators called');
        
        const context = SillyTavern.getContext();
        if (!context.extensionSettings?.progressiveSummarization?.isEnabled) {
            console.log('[Progressive Summarization] Extension not enabled, skipping indicators');
            return;
        }
        
        const chatData = context.chatMetadata?.progressiveSummarization;
        if (!chatData) {
            console.log('[Progressive Summarization] No chat data found');
            return;
        }
        
        const summarizedIds = new Set(chatData.summarizedMessageIds || []);
        const chat = context.chat;
        
        console.log('[Progressive Summarization] Chat has', chat?.length, 'messages');
        console.log('[Progressive Summarization] Summarized IDs:', Array.from(summarizedIds));
        
        if (!chat || summarizedIds.size === 0) {
            console.log('[Progressive Summarization] No chat or no summarized messages');
            return;
        }
        
        console.log('[Progressive Summarization] Adding indicators to', summarizedIds.size, 'messages');
        
        // Debug: Check what message elements exist
        const allMessageDivs = document.querySelectorAll('#chat .mes');
        console.log('[Progressive Summarization] Found', allMessageDivs.length, 'message divs in DOM');
        
        if (allMessageDivs.length > 0) {
            console.log('[Progressive Summarization] First message div:', allMessageDivs[0]);
            console.log('[Progressive Summarization] First message attributes:', {
                mesid: allMessageDivs[0].getAttribute('mesid'),
                id: allMessageDivs[0].id,
                className: allMessageDivs[0].className
            });
        }
        
        // Find all message elements and add indicators
        let indicatorsAdded = 0;
        chat.forEach((msg, index) => {
            const msgId = msg.id || msg.mes_id || msg.index || index;
            
            if (summarizedIds.has(msgId)) {
                console.log('[Progressive Summarization] Message', index, 'with ID', msgId, 'should have indicator');
                
                // Try different selectors to find the message div
                let messageDiv = document.querySelector(`#chat .mes[mesid="${index}"]`);
                
                console.log('[Progressive Summarization] Found messageDiv by mesid:', !!messageDiv);
                
                // Alternative: try finding by data attribute or other means
                if (!messageDiv) {
                    const allMessages = document.querySelectorAll('#chat .mes');
                    messageDiv = allMessages[index];
                    console.log('[Progressive Summarization] Found messageDiv by index:', !!messageDiv);
                }
                
                if (messageDiv) {
                    const alreadyHasIndicator = messageDiv.querySelector('.summarized-indicator');
                    console.log('[Progressive Summarization] Already has indicator:', !!alreadyHasIndicator);
                    
                    if (!alreadyHasIndicator) {
                        // Create indicator
                        const indicator = document.createElement('div');
                        indicator.className = 'summarized-indicator';
                        indicator.innerHTML = '<i class="fa-solid fa-compress" title="This message has been summarized"></i>';
                        indicator.style.cssText = `
                            position: absolute;
                            top: 5px;
                            right: 35px;
                            background: rgba(100, 150, 255, 0.3);
                            padding: 4px 8px;
                            border-radius: 4px;
                            font-size: 0.85em;
                            color: #6496ff;
                            z-index: 10;
                            pointer-events: none;
                        `;
                        
                        // Make the message slightly transparent
                        messageDiv.style.opacity = '0.7';
                        
                        // Ensure parent has relative positioning
                        const mesBlock = messageDiv.querySelector('.mes_block') || messageDiv;
                        mesBlock.style.position = 'relative';
                        mesBlock.appendChild(indicator);
                        
                        indicatorsAdded++;
                        console.log('[Progressive Summarization] Added indicator to message', index, msg.id);
                    }
                } else {
                    console.log('[Progressive Summarization] Could not find messageDiv for index', index);
                }
            }
        });
        
        console.log('[Progressive Summarization] Total indicators added:', indicatorsAdded);
    };

    // Handle new messages
    const handleMessageSent = () => {
        if (isEnabled) {
            checkAndSummarize();
        }
    };

    const handleMessageReceived = () => {
        if (isEnabled) {
            checkAndSummarize();
        }
    };

    // Check if we need to summarize
    const checkAndSummarize = () => {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        
        if (!chat || chat.length === 0) return;

        // Get unsummarized messages
        const unsummarizedMessages = chat.filter(msg => !summarizedMessageIds.has(msg.id || msg.mes_id || msg.index));
        
        // Calculate total tokens in unsummarized messages and collect messages up to threshold
        let totalTokens = 0;
        const messagesToSummarize = [];
        
        for (const msg of unsummarizedMessages) {
            const msgTokens = estimateTokens(msg.mes || '');
            
            // Check if adding this message would exceed threshold
            if (totalTokens + msgTokens > tokenThreshold && messagesToSummarize.length > 0) {
                // We've reached the threshold, stop here
                break;
            }
            
            totalTokens += msgTokens;
            messagesToSummarize.push(msg);
        }

        setCurrentTokenCount(totalTokens);

        // If threshold reached, trigger summarization for only the messages we collected
        if (totalTokens >= tokenThreshold && messagesToSummarize.length > 0) {
            console.log('[Progressive Summarization] Threshold reached. Summarizing', messagesToSummarize.length, 'of', unsummarizedMessages.length, 'unsummarized messages');
            performSummarization(messagesToSummarize);
        }
    };

    // Perform the actual summarization
    const performSummarization = async (messagesToSummarize) => {
        setStatus('Summarizing...');
        
        try {
            // Build the summarization prompt
            let summaryPrompt = 'Please provide a concise summary (2-3 sentences) of the following conversation:\n\n';
            
            // Include existing summaries for context
            if (summaries.length > 0) {
                summaryPrompt += 'Previous summaries:\n';
                summaries.forEach((summary, index) => {
                    summaryPrompt += `Summary ${index + 1}: ${summary.text}\n`;
                });
                summaryPrompt += '\n';
            }
            
            summaryPrompt += 'Messages to summarize:\n';
            messagesToSummarize.forEach((msg) => {
                const name = msg.is_user ? SillyTavern.getContext().name1 : msg.name;
                // Limit message length for the summary prompt
                const messageText = msg.mes.length > 200 ? msg.mes.substring(0, 200) + '...' : msg.mes;
                summaryPrompt += `${name}: ${messageText}\n`;
            });
            
            summaryPrompt += '\nGenerate a whole entire summary of what happened in the entire story, sectioning them by chapters. Only create chapters on sections where there are no summary yet. Be very generous with the paragraphs, details, and responses.';
            summaryPrompt += '\nPrevious chapters, if exists, will give clues on how the story has been.';
            summaryPrompt += '\nAt the end of the summary, have a separate section for key highlights in bullet points.';
            summaryPrompt += '\nNever be afraid to be in detail and explicit.';
            summaryPrompt += '\nGoal response count: 500 to 1000 words';
            summaryPrompt += '\nIf summaries and chapters already exist, continue on top of it.';
            summaryPrompt += '\nREMINDER OF FORBIDDEN RULES:';
            summaryPrompt += '\n- Do not invent scenes that never happened';
            summaryPrompt += '\n- Do not add fillers just to achieve the word count. If only a few words will do, so be it.';

            // Use SillyTavern's official API from getContext()
            const { generateRaw } = SillyTavern.getContext();
            
            let summaryText = '';
            
            // Use generateRaw with a system prompt as per the documentation
            const systemPrompt = 'You are a helpful assistant that creates concise summaries.';
            
            const result = await generateRaw({
                systemPrompt: systemPrompt,
                prompt: summaryPrompt,
            });
            
            // Extract the text from the result
            summaryText = result || '';
                
            // Store the new summary
            const newSummary = {
                text: summaryText,
                timestamp: Date.now(),
                messageCount: messagesToSummarize.length,
                tokenCount: messagesToSummarize.reduce((sum, msg) => sum + estimateTokens(msg.mes || ''), 0)
            };
            
            setSummaries(prev => [...prev, newSummary]);
            
            // Mark messages as summarized
            const newSummarizedIds = new Set(summarizedMessageIds);
            
            console.log('[Progressive Summarization] Analyzing messages to summarize:');
            messagesToSummarize.forEach((msg, idx) => {
                console.log(`[Progressive Summarization] Message ${idx}:`, {
                    id: msg.id,
                    mes_id: msg.mes_id,
                    index: msg.index,
                    send_date: msg.send_date,
                    hasId: !!msg.id,
                    keys: Object.keys(msg).join(', ')
                });
                
                // Try different ID fields
                const msgId = msg.id || msg.mes_id || msg.index || idx;
                if (msgId !== undefined) {
                    console.log('[Progressive Summarization] Marking message as summarized with ID:', msgId);
                    newSummarizedIds.add(msgId);
                }
            });
            
            console.log('[Progressive Summarization] Total summarized messages:', newSummarizedIds.size);
            
            setSummarizedMessageIds(newSummarizedIds);
            setCurrentTokenCount(0);
            
            setStatus(`Summarized ${messagesToSummarize.length} messages`);
            setTimeout(() => setStatus('Ready'), 3000);
            
            // Save after summarization with the NEW values directly
            const newSummaries = [...summaries, newSummary];
            await saveChatData({
                summaries: newSummaries,
                summarizedMessageIds: Array.from(newSummarizedIds),
                currentTokenCount: 0
            });
            
            // Also save global settings
            const context = SillyTavern.getContext();
            const { saveSettingsDebounced } = context;
            if (saveSettingsDebounced) {
                saveSettingsDebounced();
            }
            
            // Add visual indicators to newly summarized messages
            setTimeout(() => addSummarizedIndicators(), 500);
        } catch (error) {
            console.error('Summarization error:', error);
            setStatus('Error during summarization');
            setTimeout(() => setStatus('Ready'), 3000);
        }
    };

    // Manual trigger for summarization
    const handleManualSummarize = () => {
        const context = SillyTavern.getContext();
        const chat = context.chat;
        
        // Get unsummarized messages (using multiple possible ID fields)
        const unsummarizedMessages = chat.filter(msg => {
            const msgId = msg.id || msg.mes_id || msg.index;
            return !summarizedMessageIds.has(msgId);
        });
        
        if (unsummarizedMessages.length === 0) {
            alert('No new messages to summarize');
            return;
        }
        
        // Collect messages up to the token threshold
        let totalTokens = 0;
        const messagesToSummarize = [];
        
        for (const msg of unsummarizedMessages) {
            const msgTokens = estimateTokens(msg.mes || '');
            
            // For manual summarization, we can be more flexible
            // Only stop if we've collected at least some messages and would exceed threshold
            if (totalTokens + msgTokens > tokenThreshold && messagesToSummarize.length > 0) {
                break;
            }
            
            totalTokens += msgTokens;
            messagesToSummarize.push(msg);
        }
        
        if (messagesToSummarize.length > 0) {
            console.log('[Progressive Summarization] Manual summarize: processing', messagesToSummarize.length, 'of', unsummarizedMessages.length, 'messages');
            performSummarization(messagesToSummarize);
        } else {
            alert('No messages meet the threshold for summarization');
        }
    };

    // Clear all summaries
    const handleClearSummaries = async () => {
        if (confirm('Are you sure you want to clear all summaries for this chat?')) {
            setSummaries([]);
            setSummarizedMessageIds(new Set());
            setCurrentTokenCount(0);
            await saveChatData();
            setStatus('Summaries cleared');
            setTimeout(() => setStatus('Ready'), 2000);
            
            // Remove visual indicators
            document.querySelectorAll('.summarized-indicator').forEach(el => el.remove());
            document.querySelectorAll('#chat .mes').forEach(el => el.style.opacity = '1');
        }
    };

    // Toggle extension on/off
    const handleToggle = () => {
        setIsEnabled(!isEnabled);
    };

    return (
        <div className="progressive-summarization-settings">
            <div className="inline-drawer">
                <div className="inline-drawer-toggle inline-drawer-header">
                    <b>Progressive Summarization</b>
                    <div className="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div className="inline-drawer-content">
                    {/* Enable/Disable Toggle */}
                    <div className="flex-container flexnowrap">
                        <label className="checkbox_label">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={handleToggle}
                            />
                            <span>Enable Progressive Summarization</span>
                        </label>
                    </div>

                    {/* Token Threshold Setting */}
                    <div className="margin-top-10">
                        <label htmlFor="token-threshold">
                            <b>Token Threshold:</b>
                        </label>
                        <input
                            id="token-threshold"
                            type="number"
                            className="text_pole"
                            value={tokenThreshold}
                            onChange={(e) => setTokenThreshold(parseInt(e.target.value) || 1000)}
                            min="100"
                            step="100"
                        />
                        <small className="notes">
                            Summarize messages every X tokens (approximate)
                        </small>
                    </div>

                    {/* Current Status */}
                    <div className="margin-top-10">
                        <div><b>Status:</b> {status}</div>
                        <div><b>Current tokens:</b> {currentTokenCount} / {tokenThreshold}</div>
                        <div><b>Total summaries:</b> {summaries.length}</div>
                        <div><b>Messages summarized:</b> {summarizedMessageIds.size}</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="margin-top-10">
                        <button className="menu_button" onClick={saveSettings}>
                            <i className="fa-solid fa-save"></i> Save Settings
                        </button>
                        <button className="menu_button" onClick={handleManualSummarize} disabled={!isEnabled}>
                            <i className="fa-solid fa-bolt"></i> Summarize Now
                        </button>
                        <button className="menu_button" onClick={handleClearSummaries}>
                            <i className="fa-solid fa-trash"></i> Clear Summaries
                        </button>
                    </div>

                    {/* Display Summaries */}
                    {summaries.length > 0 && (
                        <div className="margin-top-10">
                            <b>Recent Summaries:</b>
                            <div className="progressive-summaries-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                {summaries.slice(-5).reverse().map((summary, index) => (
                                    <div key={index} className="summary-item margin-top-5" style={{ 
                                        padding: '10px', 
                                        border: '1px solid var(--SmartThemeBorderColor)',
                                        borderRadius: '5px',
                                        backgroundColor: 'var(--black30a)'
                                    }}>
                                        <div style={{ fontSize: '0.85em', color: 'var(--SmartThemeQuoteColor)' }}>
                                            {new Date(summary.timestamp).toLocaleString()} | 
                                            {summary.messageCount} messages | 
                                            {summary.tokenCount} tokens
                                        </div>
                                        <div className="margin-top-5">{summary.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
