import "./userCard.css";
import {
  MdHeadsetOff,
  MdHeadset,
  MdSettings,
  MdMicOff,
  MdMic,
} from "react-icons/md";
import { useAuth } from "../../context/authContext";

export default function UserCard() {
  const { user, setUser } = useAuth();

  return (
    <div className="user-card">
      <div className="user-info-container">
        <img className="user-avatar" src={user.avatar} alt="User Avatar" />
        <div className="user-info">
          <p className="user-name">{user.displayName || user.handle}</p>
          <p className="handle">{user.handle}</p>
          <p className="notes">
            notes over here with overflow hidden and text-overflow ellipsis
          </p>
        </div>
      </div>
      <div className="user-actions">
        <button>
          <MdMicOff size={24} />
        </button>
        <button>
          <MdHeadsetOff size={24} />
        </button>
        <button>
          <MdSettings size={24} />
        </button>
      </div>
    </div>
  );
}
