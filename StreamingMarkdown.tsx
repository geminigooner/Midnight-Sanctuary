import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';

export const StreamingMarkdown = React.memo(({ content, isGenerating }: { content: string, isGenerating: boolean }) => {
  const [displayedContent, setDisplayedContent] = useState(content);

  useEffect(() => {
    let animationFrameId: number;
    let lastUpdate = Date.now();

    const updateContent = () => {
      const now = Date.now();
      // Throttle updates during generation to every 100ms
      if (isGenerating && now - lastUpdate < 100) {
        animationFrameId = requestAnimationFrame(updateContent);
        return;
      }
      
      setDisplayedContent(content);
      lastUpdate = now;
      
      if (isGenerating) {
        animationFrameId = requestAnimationFrame(updateContent);
      }
    };

    if (isGenerating) {
      animationFrameId = requestAnimationFrame(updateContent);
    } else {
      setDisplayedContent(content);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [content, isGenerating]);

  return <Markdown>{displayedContent}</Markdown>;
});
