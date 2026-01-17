import React, { useState, useCallback, useMemo, useRef } from 'react';
import Modal from './Modal';
import { 
  getAllTitlesWithStatus, 
  getAllBordersWithStatus,
  getTitleDetails,
  getBorderDetails,
} from '../core/achievements';
import { useLanguage } from '../context/LanguageContext.jsx';
import './ProfileConfigurator.css';

// Predefined avatar emojis
const AVATAR_EMOJIS = [
  '🦊', '🦉', '🦋', '🐸', '🌿', '🍄', '🌸', '🦎', '🐝', '🌳',
  '🐦', '🦌', '🐺', '🦅', '🌻', '🐢', '🦇', '🐠'
];

/**
 * ProfileConfigurator - Complete profile customization modal
 * Features:
 * - Three tabs: Avatar, Border, Title
 * - Live preview
 * - Avatar selection (emoji or custom upload)
 * - "None/Default" option for borders and titles
 */
const ProfileConfigurator = ({ 
  isOpen, 
  onClose, 
  onSave, 
  profile,
  displayName 
}) => {
  const { t } = useLanguage();
  
  // Tab state
  const [activeTab, setActiveTab] = useState('avatar');
  
  // Preview states
  const [previewName, setPreviewName] = useState(displayName || '');
  const [previewAvatar, setPreviewAvatar] = useState(profile?.avatar || null);
  const [previewTitle, setPreviewTitle] = useState(profile?.rewards?.equippedTitle || 'default');
  const [previewBorder, setPreviewBorder] = useState(profile?.rewards?.equippedBorder || 'default');
  
  // File upload ref
  const fileInputRef = useRef(null);

  // Get titles and borders with unlock status
  const titlesWithStatus = useMemo(() => {
    return getAllTitlesWithStatus(profile?.rewards);
  }, [profile?.rewards]);

  const bordersWithStatus = useMemo(() => {
    return getAllBordersWithStatus(profile?.rewards);
  }, [profile?.rewards]);

  // Handle avatar emoji selection
  const handleSelectEmoji = useCallback((emoji) => {
    setPreviewAvatar({ type: 'emoji', value: emoji });
  }, []);

  // Handle custom image upload
  const handleImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewAvatar({ type: 'image', value: e.target.result });
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle title selection
  const handleSelectTitle = useCallback((titleId, isUnlocked) => {
    if (!isUnlocked) return;
    setPreviewTitle(titleId);
  }, []);

  // Handle border selection
  const handleSelectBorder = useCallback((borderId, isUnlocked) => {
    if (!isUnlocked) return;
    setPreviewBorder(borderId);
  }, []);

  // Reset avatar to default letter
  const handleResetAvatar = useCallback(() => {
    setPreviewAvatar(null);
  }, []);

  // Save changes
  const handleSave = useCallback(() => {
    const changes = {
      name: previewName.trim() || displayName,
      avatar: previewAvatar,
      equippedTitle: previewTitle,
      equippedBorder: previewBorder,
    };
    onSave(changes);
    onClose();
  }, [previewName, previewAvatar, previewTitle, previewBorder, displayName, onSave, onClose]);

  // Check if save button should be disabled
  const isSaveDisabled = useMemo(() => {
    const titleLocked = previewTitle && previewTitle !== 'default' && 
      !titlesWithStatus.find(t => t.id === previewTitle)?.unlocked;
    const borderLocked = previewBorder && previewBorder !== 'default' && 
      !bordersWithStatus.find(b => b.id === previewBorder)?.unlocked;
    return titleLocked || borderLocked;
  }, [previewTitle, previewBorder, titlesWithStatus, bordersWithStatus]);

  // Get preview display
  const avatarDisplay = useMemo(() => {
    if (previewAvatar?.type === 'emoji') {
      return { type: 'emoji', value: previewAvatar.value };
    }
    if (previewAvatar?.type === 'image') {
      return { type: 'image', value: previewAvatar.value };
    }
    return { type: 'letter', value: (previewName || displayName || 'E').charAt(0).toUpperCase() };
  }, [previewAvatar, previewName, displayName]);

  const borderCss = useMemo(() => {
    return getBorderDetails(previewBorder)?.css || '';
  }, [previewBorder]);

  const titleDisplay = useMemo(() => {
    if (!previewTitle || previewTitle === 'default') return null;
    const details = getTitleDetails(previewTitle);
    return details?.value || t(details?.nameKey);
  }, [previewTitle, t]);

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} className="profile-configurator-modal">
      <div className="profile-configurator">
        {/* Header with live preview */}
        <div className="configurator-header">
          <h2 className="configurator-title">{t('profile.edit_profile')}</h2>
          
          {/* Live preview */}
          <div className="configurator-preview">
            <div className={`preview-avatar-ring ${borderCss}`}>
              {avatarDisplay.type === 'emoji' && (
                <span className="preview-emoji">{avatarDisplay.value}</span>
              )}
              {avatarDisplay.type === 'image' && (
                <img src={avatarDisplay.value} alt="Avatar" className="preview-image" />
              )}
              {avatarDisplay.type === 'letter' && (
                <span className="preview-letter">{avatarDisplay.value}</span>
              )}
            </div>
            <div className="preview-info">
              <span className="preview-name">{previewName || displayName || t('profile.title')}</span>
              {titleDisplay && (
                <span className="preview-title-badge">{titleDisplay}</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="configurator-tabs" role="tablist">
          <button
            className={`configurator-tab ${activeTab === 'avatar' ? 'active' : ''}`}
            onClick={() => setActiveTab('avatar')}
            role="tab"
            aria-selected={activeTab === 'avatar'}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-label">{t('profile.tab_avatar')}</span>
          </button>
          <button
            className={`configurator-tab ${activeTab === 'border' ? 'active' : ''}`}
            onClick={() => setActiveTab('border')}
            role="tab"
            aria-selected={activeTab === 'border'}
          >
            <span className="tab-icon">🖼️</span>
            <span className="tab-label">{t('profile.tab_border')}</span>
          </button>
          <button
            className={`configurator-tab ${activeTab === 'title' ? 'active' : ''}`}
            onClick={() => setActiveTab('title')}
            role="tab"
            aria-selected={activeTab === 'title'}
          >
            <span className="tab-icon">🏷️</span>
            <span className="tab-label">{t('profile.tab_title')}</span>
          </button>
        </div>

        {/* Tab content */}
        <div className="configurator-content">
          {/* Avatar tab */}
          {activeTab === 'avatar' && (
            <div className="tab-panel tab-avatar" role="tabpanel">
              {/* Name input */}
              <div className="config-section">
                <label className="config-label">{t('profile.edit_name')}</label>
                <input
                  type="text"
                  className="config-input"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder={t('profile.title')}
                  maxLength={30}
                />
              </div>

              {/* Default option */}
              <div className="config-section">
                <label className="config-label">{t('profile.avatar_style')}</label>
                <div className="avatar-options">
                  <button
                    className={`avatar-option avatar-option-default ${!previewAvatar ? 'selected' : ''}`}
                    onClick={handleResetAvatar}
                    aria-label={t('profile.avatar_default')}
                  >
                    <span className="avatar-option-letter">
                      {(previewName || displayName || 'E').charAt(0).toUpperCase()}
                    </span>
                    <span className="avatar-option-label">{t('profile.avatar_default')}</span>
                  </button>

                  {/* Upload button */}
                  <button
                    className={`avatar-option avatar-option-upload ${previewAvatar?.type === 'image' ? 'selected' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t('profile.avatar_upload')}
                  >
                    <span className="avatar-option-icon">📷</span>
                    <span className="avatar-option-label">{t('profile.avatar_upload')}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden-input"
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Emoji grid */}
              <div className="config-section">
                <label className="config-label">{t('profile.avatar_emoji')}</label>
                <div className="emoji-grid">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className={`emoji-option ${previewAvatar?.type === 'emoji' && previewAvatar?.value === emoji ? 'selected' : ''}`}
                      onClick={() => handleSelectEmoji(emoji)}
                      aria-label={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Border tab */}
          {activeTab === 'border' && (
            <div className="tab-panel tab-border" role="tabpanel">
              <div className="config-section">
                <label className="config-label">{t('profile.select_border')}</label>
                <div className="border-grid">
                  {bordersWithStatus.map((border) => {
                    const isSelected = previewBorder === border.id;
                    const isUnlocked = border.unlocked;
                    return (
                      <button
                        key={border.id}
                        className={`border-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                        onClick={() => handleSelectBorder(border.id, isUnlocked)}
                        disabled={!isUnlocked}
                        aria-label={t(border.nameKey)}
                      >
                        <div className={`border-option-preview ${border.css || ''}`}>
                          <span className="border-option-letter">A</span>
                        </div>
                        <span className="border-option-name">
                          {t(border.nameKey)}
                        </span>
                        {!isUnlocked && <span className="lock-badge">🔒</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Title tab */}
          {activeTab === 'title' && (
            <div className="tab-panel tab-title" role="tabpanel">
              <div className="config-section">
                <label className="config-label">{t('profile.select_title')}</label>
                <div className="title-grid">
                  {titlesWithStatus.map((title) => {
                    const isSelected = previewTitle === title.id;
                    const isUnlocked = title.unlocked;
                    const displayValue = title.value || t(title.nameKey);
                    return (
                      <button
                        key={title.id}
                        className={`title-option ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`}
                        onClick={() => handleSelectTitle(title.id, isUnlocked)}
                        disabled={!isUnlocked}
                        aria-label={displayValue}
                      >
                        <span className="title-option-text">{displayValue}</span>
                        {!isUnlocked && <span className="lock-badge">🔒</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="configurator-actions">
          <button
            className="configurator-btn configurator-btn-primary"
            onClick={handleSave}
            disabled={isSaveDisabled}
          >
            {t('common.save')}
          </button>
          <button
            className="configurator-btn configurator-btn-secondary"
            onClick={onClose}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileConfigurator;
