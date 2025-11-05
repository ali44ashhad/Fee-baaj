import { useState, useEffect, ChangeEvent } from "react";
import { FiEdit, FiTrash, FiSave, FiX } from "react-icons/fi";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VideoPopup {
  link?: string;
  popupDuration?: number;
  triggerAt?: number;
}

interface VideoPopupManagerProps {
  videoPopups: VideoPopup[];
  onUpdate: (updatedPopups: VideoPopup[]) => void;
  videoLength: number; // in seconds
}

const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/; // Simple URL validation regex

const VideoPopupManager: React.FC<VideoPopupManagerProps> = ({
  videoPopups,
  onUpdate,
  videoLength,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // States for new popup inputs
  const [newPopupLink, setNewPopupLink] = useState("");
  const [newPopupDuration, setNewPopupDuration] = useState(1);
  const [newPopupMinutes, setNewPopupMinutes] = useState(0);
  const [newPopupSeconds, setNewPopupSeconds] = useState(0);
  const [newErrorMessage, setNewErrorMessage] = useState("");

  // When editing, sync minutes and seconds with the popup's triggerAt
  useEffect(() => {
    if (editingIndex !== null) {
      const popup = videoPopups[editingIndex];
      setMinutes(Math.floor(popup.triggerAt / 60));
      setSeconds(popup.triggerAt % 60);
      setErrorMessage("");
    }
  }, [editingIndex, videoPopups]);

  const formatTime = (totalSeconds: number) => {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    return `${String(min).padStart(2, "0")}min:${String(sec).padStart(2, "0")}sec`;
  };

  const handleEditClick = (index: number) => {
    setEditingIndex(index);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updatedPopups = [...videoPopups];

    updatedPopups[editingIndex!] = {
      ...updatedPopups[editingIndex!],
      [name]: name === "link" ? value : Number(value),
    };
    onUpdate(updatedPopups);
  };

  const handleSaveClick = () => {
    if (editingIndex === null) return;
    const newTriggerAt = minutes * 60 + seconds;

    // Validate seconds range
    if (seconds < 0 || seconds > 59) {
      setErrorMessage("Seconds must be between 0 and 59.");
      return;
    }

    // Validate triggerAt is within videoLength
    if (newTriggerAt > videoLength) {
      setErrorMessage("Popup trigger time exceeds video length.");
      return;
    }

    // Validate uniqueness: no other popup should have the same triggerAt
    const conflict = videoPopups.some(
      (p, idx) => idx !== editingIndex && p.triggerAt === newTriggerAt
    );
    if (conflict) {
      setErrorMessage("Another popup is already scheduled at this time.");
      return;
    }

    // Validate URL before saving
    if (!urlRegex.test(videoPopups[editingIndex!].link.trim())) {
      setErrorMessage("Please enter a valid URL.");
      return;
    }
    if(videoPopups[editingIndex!].popupDuration < 1){
      setErrorMessage("Video popup duration should be equal or greater than 1 second")
      return 
    }

    const updatedPopups = [...videoPopups];
    updatedPopups[editingIndex!] = {
      ...updatedPopups[editingIndex!],
      triggerAt: newTriggerAt,
    };

    onUpdate(updatedPopups);
    setEditingIndex(null);
};

  const handleCancelClick = () => {
    setEditingIndex(null);
    setErrorMessage("");
  };

  const handleDeleteClick = (index: number) => {
    if (videoPopups.length > 1) {
      const updatedPopups = videoPopups.filter((_, i) => i !== index);
      onUpdate(updatedPopups);
    } else {
      alert("At least one popup is required.");
    }
  };

  // Handler for adding a new popup with validation
  const handleAddNewPopup = () => {
    const newTriggerAt = newPopupMinutes * 60 + newPopupSeconds;
    // Validate seconds range for new popup
    if (newPopupSeconds < 0 || newPopupSeconds > 59) {
      setNewErrorMessage("Seconds must be between 0 and 59.");
      return;
    }
    // Validate triggerAt within video length
    if (newTriggerAt > videoLength) {
      setNewErrorMessage("Popup trigger time exceeds video length.");
      return;
    }
    // Validate uniqueness: no existing popup has same triggerAt
    const conflict = videoPopups.some((p) => p.triggerAt === newTriggerAt);
    if (conflict) {
      setNewErrorMessage("A popup is already scheduled at this time.");
      return;
    }
    // Validate the new popup link is not empty and is a valid URL
    if (!newPopupLink.trim() || !urlRegex.test(newPopupLink.trim())) {
      setNewErrorMessage("Please enter a valid popup link.");
      return;
    }
    const newPopup: VideoPopup = {
      link: newPopupLink,
      popupDuration: newPopupDuration,
      triggerAt: newTriggerAt,
    };
    const updatedPopups = [...videoPopups, newPopup];
    onUpdate(updatedPopups);
    // Reset new popup fields and error message
    setNewPopupLink("");
    setNewPopupDuration(1);
    setNewPopupMinutes(0);
    setNewPopupSeconds(0);
    setNewErrorMessage("");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-gray-700 mt-4 ">Edit or remove video Popup or notification.</h3>
      <span className="text-sm text-gray-500">Video length: {formatTime(videoLength)}</span>
      {videoPopups.map((popup, index) => (
        <div key={index} className="flex flex-col md:flex-row items-center mt-5 space-x-3 p-2 border rounded-md">
          <div className="flex-1">
            {editingIndex === index ? (
              <>
                <Input
                  name="link"
                  value={popup.link}
                  onChange={handleInputChange}
                  placeholder="Link"
                  className="mb-2"
                />
                
                <Input
                  name="popupDuration"
                  type="number"
                  value={popup.popupDuration}
                  onChange={handleInputChange}
                  placeholder="Duration (sec)"
                  className="mb-2"
                />
                <div className="flex items-center space-x-1">
                  <Input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    placeholder="mm"
                    className="w-20 text-center"
                  />
                   <span>min</span>
                  <span>:</span>
                  <Input
                    type="number"
                    value={seconds}
                    onChange={(e) => setSeconds(Number(e.target.value))}
                    placeholder="ss"
                    className="w-20 text-center"
                  />
                  <span>sec</span>
                </div>
                {errorMessage && <p className="text-red-600 text-sm mt-1">{errorMessage}</p>}
              </>
            ) : (
              <>
                <a
                  href={popup.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black font-bold text-sm underline"
                >
                  {popup.link}
                </a>
                <p className="text-gray-600">Duration: {popup.popupDuration}s</p>
                <p className="text-gray-600">Trigger At: {formatTime(popup.triggerAt)}</p>
              </>
            )}
          </div>
          <div className="flex-shrink-0 mt-2 md:mt-0">
            {editingIndex === index ? (
              <>
                <Button onClick={handleSaveClick} title="Save" variant="ghost">
                  <FiSave />
                </Button>
                <Button onClick={handleCancelClick} title="Cancel" variant="ghost">
                  <FiX />
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => handleEditClick(index)} title="Edit" variant="ghost">
                  <FiEdit />
                </Button>
                <Button onClick={() => handleDeleteClick(index)} title="Delete" variant="ghost">
                  <FiTrash />
                </Button>
              </>
            )}
          </div>
        </div>
      ))}

      {/* Section to add a new popup */}
      <div className="mt-5 p-4 border rounded-md">
        <h3 className="text-lg font-bold mb-2">Add New Popup</h3>
        <div className="space-y-3">
          <Input
            value={newPopupLink}
            onChange={(e) => setNewPopupLink(e.target.value)}
            placeholder="New popup link"
          />
          <Input
            type="number"
            value={newPopupDuration}
            onChange={(e) => setNewPopupDuration(Number(e.target.value))}
            placeholder="Duration (sec)"
          />
          <div className="flex items-center space-x-1">
            <Input
              type="number"
              value={newPopupMinutes}
              onChange={(e) => setNewPopupMinutes(Number(e.target.value))}
              placeholder="mm"
              className="w-20 text-center"
            />
            <span>min</span>
            <span>:</span>
            <Input
              
              type="number"
              value={newPopupSeconds}
              onChange={(e) => setNewPopupSeconds(Number(e.target.value))}
              placeholder="ss"
              className="w-20 text-center"
            />
            <span>sec</span>
          </div>
          {newErrorMessage && <p className="text-red-600 text-sm">{newErrorMessage}</p>}
          <Button onClick={handleAddNewPopup}>Add Popup</Button>
        </div>
      </div>
    </div>
  );
};

export default VideoPopupManager;
