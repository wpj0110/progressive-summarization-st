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

    // Load settings when component mounts (similar to ngOnInit)
    useEffect(() => {
        loadSettings();
        
        // Register event listeners for message events
        if (window.eventSource) {
            window.eventSource.on('MESSAGE_SENT', handleMessageSent);
            window.eventSource.on('MESSAGE_RECEIVED', handleMessageReceived);
        }

        // Cleanup on unmount (similar to ngOnDestroy)
        return () => {
            if (window.eventSource) {
                window.eventSource.removeListener('MESSAGE_SENT', handleMessageSent);
                window.eventSource.removeListener('MESSAGE_RECEIVED', handleMessageReceived);
            }
        };
    }, []);

    // Load settings from extension storage
    const loadSettings = () => {
        const settings = SillyTavern.getContext().extensionSettings?.progressiveSummarization || {};
        setTokenThreshold(settings.tokenThreshold || 1000);
        setIsEnabled(settings.isEnabled || false);
        setSummaries(settings.summaries || []);
        setSummarizedMessageIds(new Set(settings.summarizedMessageIds || []));
        setCurrentTokenCount(settings.currentTokenCount || 0);
    };

    // Save settings to extension storage
    const saveSettings = () => {
        const context = SillyTavern.getContext();
        if (!context.extensionSettings) {
            context.extensionSettings = {};
        }
        if (!context.extensionSettings.progressiveSummarization) {
            context.extensionSettings.progressiveSummarization = {};
        }
        
        context.extensionSettings.progressiveSummarization = {
            tokenThreshold,
            isEnabled,
            summaries,
            summarizedMessageIds: Array.from(summarizedMessageIds),
            currentTokenCount
        };
        
        // Use the official saveSettingsDebounced from getContext
        const { saveSettingsDebounced } = SillyTavern.getContext();
        saveSettingsDebounced();
        
        setStatus('Settings saved');
        setTimeout(() => setStatus('Ready'), 2000);
    };

    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimateTokens = (text) => {
        return Math.ceil(text.length / 4);
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
        const unsummarizedMessages = chat.filter(msg => !summarizedMessageIds.has(msg.id));
        
        // Calculate total tokens in unsummarized messages
        let totalTokens = 0;
        unsummarizedMessages.forEach(msg => {
            totalTokens += estimateTokens(msg.mes || '');
        });

        setCurrentTokenCount(totalTokens);

        // If threshold reached, trigger summarization
        if (totalTokens >= tokenThreshold && unsummarizedMessages.length > 0) {
            performSummarization(unsummarizedMessages);
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
            summaryPrompt += '\nAt the end of the summary, have a separate section for key highlights, such as mentioning how Tobi loves Lyraenne\'s body and vice versa.';
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
            messagesToSummarize.forEach(msg => {
                if (msg.id) newSummarizedIds.add(msg.id);
            });
            setSummarizedMessageIds(newSummarizedIds);
            setCurrentTokenCount(0);
            
            setStatus(`Summarized ${messagesToSummarize.length} messages`);
            setTimeout(() => setStatus('Ready'), 3000);
            
            // Save after summarization
            saveSettings();
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
        const unsummarizedMessages = chat.filter(msg => !summarizedMessageIds.has(msg.id));
        
        if (unsummarizedMessages.length > 0) {
            performSummarization(unsummarizedMessages);
        } else {
            alert('No new messages to summarize');
        }
    };

    // Clear all summaries
    const handleClearSummaries = () => {
        if (confirm('Are you sure you want to clear all summaries?')) {
            setSummaries([]);
            setSummarizedMessageIds(new Set());
            setCurrentTokenCount(0);
            saveSettings();
            setStatus('Summaries cleared');
            setTimeout(() => setStatus('Ready'), 2000);
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
