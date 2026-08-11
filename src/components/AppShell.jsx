import { useState, useEffect, useRef } from "react";
import Avatar from "./Avatar.jsx";
import SignalsTab from "./SignalsTab.jsx";
import ChatTab from "./ChatTab.jsx";
import NotifyBanner from "./NotifyBanner.jsx";
import Settings from "./Settings.jsx";
import { HeartOutline, ChatIcon, SettingsIcon } from "../Icons.jsx";
import { usePairData } from "../hooks/usePairData.js";

export default function AppShell({
  pairId,
  pairCode,
  identity,
  avatar,
  onSaveProfile,
  onLogout,
  notifyBanner,
  onEnableNotifyFromBanner,
  onShowIosInstructions,
  onDismissBanner,
}) {
  const [activeTab, setActiveTab] = useState("signals");
  const [chatUnread, setChatUnread] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { signals, messages, partner, sendSignal, sendMessage } = usePairData(pairId, identity);

  // Flag the Chat tab when a new message arrives while looking at Signals
  // (skips the very first load, which is existing history, not "new").
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      if (prevMessageCountRef.current > 0 && activeTab !== "chat") {
        setChatUnread(true);
      }
      prevMessageCountRef.current = messages.length;
    }
  }, [messages, activeTab]);

  function selectTab(tab) {
    setActiveTab(tab);
    if (tab === "chat") setChatUnread(false);
  }

  return (
    <div className="mya-app-v2">
      <header className="mya-header">
        <div className="mya-header-id">
          <Avatar name={identity} url={avatar} size={32} />
          <span className="mya-hi">Hi, {identity}</span>
        </div>
        <button
          className="mya-settings-gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
        >
          <SettingsIcon />
        </button>
      </header>

      <NotifyBanner
        type={notifyBanner}
        onEnable={onEnableNotifyFromBanner}
        onShowIos={onShowIosInstructions}
        onDismiss={onDismissBanner}
      />

      <div className="mya-tab-content">
        {activeTab === "signals" ? (
          <SignalsTab identity={identity} signals={signals} sendSignal={sendSignal} />
        ) : (
          <ChatTab identity={identity} partner={partner} messages={messages} sendMessage={sendMessage} />
        )}
      </div>

      <nav className="mya-tabbar">
        <button
          className={`mya-tab-btn${activeTab === "signals" ? " active" : ""}`}
          onClick={() => selectTab("signals")}
        >
          <HeartOutline className="mya-tab-icon" />
          <span>Signals</span>
        </button>
        <button
          className={`mya-tab-btn${activeTab === "chat" ? " active" : ""}`}
          onClick={() => selectTab("chat")}
        >
          <ChatIcon className="mya-tab-icon" />
          <span>Chat</span>
          {chatUnread && <span className="mya-tab-dot" />}
        </button>
      </nav>

      {settingsOpen && (
        <Settings
          identity={identity}
          avatar={avatar}
          pairId={pairId}
          pairCode={pairCode}
          onSaveProfile={onSaveProfile}
          onEnableNotify={onEnableNotifyFromBanner}
          onLogout={onLogout}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
