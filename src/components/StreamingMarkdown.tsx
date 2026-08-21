import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-markdown';

export const StreamingMarkdown = React.memo(({ content, isGenerating }: { content: string, isGenerating: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(content);
  const lastUpdateTime = useRef(Date.now());

  useEffect(() => {
    if (!isGenerating) {
      setDisplayedContent(content);
      return;
    }

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    
    // Dynamically adjust throttle based on content length to prevent freezing on huge responses
    const throttleDelay = content.length > 4000 ? 500 : (content.length > 1500 ? 250 : 100);

    if (timeSinceLastUpdate >= throttleDelay) {
      setDisplayedContent(content);
      lastUpdateTime.current = now;
    } else {
      const timer = setTimeout(() => {
        setDisplayedContent(content);
        lastUpdateTime.current = Date.now();
      }, throttleDelay - timeSinceLastUpdate);
      return () => clearTimeout(timer);
    }
  }, [content, isGenerating]);

  // Catch up when stopped
  useEffect(() => {
    if (!isGenerating && displayedContent !== content) {
      setDisplayedContent(content);
    }
  }, [isGenerating, content, displayedContent]);

  return <Markdown>{displayedContent}</Markdown>;
});
