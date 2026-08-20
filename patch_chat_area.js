import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// 1. Fix handleCopy (fallback to document.execCommand if navigator.clipboard fails/is unavailable)
const searchCopy = `  const handleCopy = React.useCallback((text: string) => { navigator.clipboard.writeText(text); }, []);`;
const replaceCopy = `  const handleCopy = React.useCallback(async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          console.error('execCommand error', error);
        } finally {
          textArea.remove();
        }
      }
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, []);`;
code = code.replace(searchCopy, replaceCopy);

// 2. Fix exportMarkdown's copy fallback
const searchExportCopy = `    } catch (e) {
      navigator.clipboard.writeText(md);
      alert('Conversation copied to clipboard.');
    }
    // Also explicitly copy to clipboard as fallback
    navigator.clipboard.writeText(md).then(() => {
       console.log('Copied to clipboard');
    }).catch(e => console.error(e));`;
const replaceExportCopy = `    } catch (e) {
      handleCopy(md);
      alert('Conversation copied to clipboard.');
    }
    // Also explicitly copy to clipboard as fallback
    handleCopy(md);`;
code = code.replace(searchExportCopy, replaceExportCopy);

// 3. Update MessageBubble to track favorited state
const searchBubbleState = `  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [settled, setSettled] = useState(false);`;
const replaceBubbleState = `  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [settled, setSettled] = useState(false);
  const [favorited, setFavorited] = useState(false);`;
code = code.replace(searchBubbleState, replaceBubbleState);

// 4. Update the favorite button rendering
const searchHeartButton = `            <button onClick={() => { 
                onFavorite?.(publicText);
                triggerHaptic('light');
              }} className="p-1.5 bg-glass rounded-lg hover:bg-white/10 hover:text-champagne text-mauve transition-colors" title="Favorite / Save to Memory">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>`;
const replaceHeartButton = `            <button onClick={() => { 
                if (!favorited) {
                  onFavorite?.(publicText);
                  setFavorited(true);
                }
                triggerHaptic('light');
              }} className={\`p-1.5 bg-glass rounded-lg hover:bg-white/10 transition-colors \${favorited ? 'text-copper' : 'text-mauve hover:text-champagne'}\`} title={favorited ? 'Saved to Memories' : 'Favorite / Save to Memory'}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>`;
code = code.replace(searchHeartButton, replaceHeartButton);

fs.writeFileSync('src/components/ChatArea.tsx', code);
