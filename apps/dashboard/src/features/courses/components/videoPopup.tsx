import { useState } from "react";
// Replaced "react-icons/fi" with "lucide-react" equivalent, which is typically available.
import { PlusIcon } from "lucide-react"; 
// Assuming you have these components available
import { Button } from '@/components/ui/button'; 
import { Input } from '@/components/ui/input'; 

interface VideoPopupProps {
  videoDuration: number; // Total video duration in seconds
  onAddPopup: (link: string, popupDuration: number, triggerAt: number) => void; // Function to add a popup
}

const VideoPopup: React.FC<VideoPopupProps> = ({ videoDuration, onAddPopup }) => {
  const [minute, setMinute] = useState<number>(0);
  const [second, setSecond] = useState<number>(0);
  const [linkText, setLinkText] = useState<string>("");
  const [duration, setDuration] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);

  const isValidUrl = (url: string) => {
    try {
      new URL(url); 
      return true;
    } catch (_) {
      // Allow simple domains without protocol for better UX, but require a dot.
      return url.includes('.') && url.length > 5;
    }
  };

  const formatVideoDuration = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = (totalSeconds % 60).toFixed(1); // one decimal only
    return `${String(min).padStart(2, "0")}m:${sec.padStart(4, "0")}s`;
  };

  // The function to handle data submission (no longer triggered by form onSubmit)
  const addMoment = () => {
    // Since this is called via button onClick (not form onSubmit), 
    // there is no event object, and no e.preventDefault() is needed.
    setError(null); 

    const totalTimestamp = minute * 60 + second;

    // --- Validation Logic (Preserved) ---
    if (!linkText.trim()) {
      setError("Popup URL is required.");
      return;
    }
    if (!isValidUrl(linkText.trim())) {
      setError("Popup URL is invalid. Ensure it includes a domain (e.g., 'https://example.com').");
      return;
    }
    if (totalTimestamp === 0) {
      setError("Trigger time must be greater than 0 seconds.");
      return;
    }
    if (totalTimestamp > videoDuration) {
      setError(`Trigger time (${formatVideoDuration(totalTimestamp)}) cannot exceed video duration (${formatVideoDuration(videoDuration)}).`);
      return;
    }
    if (duration < 1) {
      setError("Duration must be 1 second or greater.");
      return;
    }
    if (second < 0 || second > 59) {
        setError("Seconds must be between 0 and 59.");
        return;
    }
    // --- End Validation Logic ---

    // Call the parent function to add the popup
    onAddPopup(linkText.trim(), duration, totalTimestamp);

    // Reset inputs
    setMinute(0);
    setSecond(0);
    setLinkText("");
    setDuration(1);
  };

  return (
    // Replaced <form> with <div> to prevent all form-related browser defaults
    <div className="space-y-4 p-4 border border-dashed rounded-lg bg-gray-50/50">
      <h3 className="font-semibold text-gray-700">Schedule New Popup Link</h3>
      
      {/* Informational Banner */}
      <div className="text-sm text-gray-600">
        Total Video Length: <span className="font-medium text-blue-600">{formatVideoDuration(videoDuration)}</span>
      </div>

      {/* 1. Link Input */}
      <Input
        label="Popup Link URL"
        type="text"
        value={linkText}
        onChange={(e) => setLinkText(e.target.value)}
        placeholder="e.g., https://your-external-link.com"
        error={error && (error.includes('URL is required') || error.includes('URL is invalid')) ? error : undefined}
      />
      
      {/* 2. Trigger Time & Duration Inputs */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 block">Trigger Time</label>
        
        {/* Min and Sec on one line, taking equal space */}
        <div className="flex items-end gap-x-3"> 
          
          {/* Minutes Input (1/2 width) */}
          <div className="w-1/2"> 
            <Input
              label="Min"
              type="number"
              min={0}
              value={minute}
              onChange={(e) => setMinute(Math.max(0, Number(e.target.value)))}
              className="text-center"
            />
          </div>

          {/* Seconds Input (1/2 width) */}
          <div className="w-1/2">
            <Input
              label="Sec"
              type="number"
              min={0}
              max={59}
              value={second}
              onChange={(e) => setSecond(Math.min(59, Math.max(0, Number(e.target.value))))}
              className="text-center"
            />
          </div>
        </div>
        
        {/* Duration Input on its own full line */}
        <div className="w-full"> 
          <Input
            label="Duration (s)"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
            className="text-center"
          />
        </div>

      </div>

      {/* 3. Error Message */}
      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* 4. Add Button - Now uses onClick directly */}
      <Button 
        type="button" // Set type to "button" to prevent any latent submit behavior
        onClick={addMoment} // Call the function directly on click
        className="w-full mt-4"
        disabled={videoDuration === 0}
      >
        {/* Used PlusIcon instead of FiPlus */}
        <PlusIcon className="mr-2 h-4 w-4" /> Schedule Popup
      </Button>
      {videoDuration === 0 && (
          <p className="text-sm text-orange-500 text-center">Cannot add popups until the lecture video's duration is determined.</p>
      )}
    </div>
  );
};

export default VideoPopup;
