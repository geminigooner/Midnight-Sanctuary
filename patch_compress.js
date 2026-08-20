import fs from 'fs';
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const helper = `
const compressImage = (file: File): Promise<{ mimeType: string, data: string, previewUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxEdge = 1024;
        if (width > maxEdge || height > maxEdge) {
          if (width > height) {
            height = Math.round((height * maxEdge) / width);
            width = maxEdge;
          } else {
            width = Math.round((width * maxEdge) / height);
            height = maxEdge;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');
        ctx.drawImage(img, 0, 0, width, height);
        
        let quality = 0.85;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let base64Data = dataUrl.split(',')[1];
        
        if (base64Data.length > 700000) {
          quality = 0.6;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
          base64Data = dataUrl.split(',')[1];
        }
        
        resolve({
          mimeType: 'image/jpeg',
          data: base64Data,
          previewUrl: dataUrl
        });
      };
      img.onerror = reject;
      img.src = result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

interface ChatAreaProps {`;

code = code.replace("interface ChatAreaProps {", helper);

const searchHandler = `  const handleGiftFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
       alert('Only images are supported currently.');
       return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
       const result = event.target?.result as string;
       const base64Data = result.split(',')[1];
       setGiftFile({
         mimeType: file.type,
         data: base64Data,
         previewUrl: result
       });
    };
    reader.readAsDataURL(file);
    if (giftFileInputRef.current) giftFileInputRef.current.value = '';
  };`;

const replaceHandler = `  const handleGiftFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
       alert('Only images are supported currently.');
       return;
    }

    try {
      const compressed = await compressImage(file);
      setGiftFile(compressed);
    } catch (err) {
      console.error("Failed to compress image:", err);
    }
    
    if (giftFileInputRef.current) giftFileInputRef.current.value = '';
  };`;

code = code.replace(searchHandler, replaceHandler);

fs.writeFileSync('src/components/ChatArea.tsx', code);
