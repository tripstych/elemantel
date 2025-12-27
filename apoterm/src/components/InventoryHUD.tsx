import React, { useState, useEffect } from 'react';
import { gameClient } from '../services/GameClient';

interface InventoryHUDProps {
  isVisible: boolean;
  onClose: () => void;
  playerState: any;
}

export const InventoryHUD: React.FC<InventoryHUDProps> = ({ isVisible, onClose, playerState }) => {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  if (!isVisible || !playerState) return null;

  const inventory = playerState.inventory || [];
  const slots = playerState.slots || {};
  const handSlots = slots.hand_slots || {};
  const bodySlots = slots.body_slots || {};

  const handleEquip = (slotPath: string) => {
    if (!selectedItem) {
      setMessage('Select an item first!');
      return;
    }
    
    gameClient.equipItem(slotPath, selectedItem);
    setMessage(`Equipping ${selectedItem} to ${slotPath}...`);
    setSelectedItem('');
  };

  const handleUnequip = (slotPath: string) => {
    gameClient.unequipItem(slotPath);
    setMessage(`Unequipping from ${slotPath}...`);
  };

  const handleDrop = (itemName: string) => {
    gameClient.dropItem(itemName);
    setMessage(`Dropping ${itemName}...`);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#2a2a2a',
      border: '2px solid #gold',
      borderRadius: '8px',
      padding: '20px',
      minWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 1000,
      color: 'white'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#gold' }}>Inventory & Equipment</h2>
        <button 
          onClick={onClose}
          style={{
            backgroundColor: '#8B0000',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '5px 10px',
            cursor: 'pointer'
          }}
        >
          X
        </button>
      </div>

      {message && (
        <div style={{
          backgroundColor: '#4a4a4a',
          padding: '10px',
          borderRadius: '4px',
          marginBottom: '15px',
          color: '#90EE90'
        }}>
          {message}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Inventory Section */}
        <div>
          <h3 style={{ color: '#gold', marginBottom: '10px' }}>Inventory</h3>
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #555',
            borderRadius: '4px',
            padding: '10px',
            minHeight: '200px'
          }}>
            {inventory.length === 0 ? (
              <div style={{ color: '#888', fontStyle: 'italic' }}>No items in inventory</div>
            ) : (
              inventory.map((item: string, index: number) => (
                <div
                  key={index}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    padding: '8px',
                    margin: '2px 0',
                    backgroundColor: selectedItem === item ? '#4a4a4a' : '#2a2a2a',
                    border: selectedItem === item ? '1px solid #gold' : '1px solid #555',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{item}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDrop(item);
                    }}
                    style={{
                      backgroundColor: '#8B4513',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Drop
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Equipment Section */}
        <div>
          <h3 style={{ color: '#gold', marginBottom: '10px' }}>Equipment Slots</h3>
          
          {/* Hand Slots */}
          <div style={{ marginBottom: '15px' }}>
            <h4 style={{ color: '#87CEEB', fontSize: '14px', marginBottom: '5px' }}>Hand Slots</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <SlotItem
                slotName="Main Hand"
                slotPath="hand_slots.main_hand"
                item={handSlots.main_hand}
                onEquip={() => handleEquip("hand_slots.main_hand")}
                onUnequip={() => handleUnequip("hand_slots.main_hand")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Off Hand"
                slotPath="hand_slots.off_hand"
                item={handSlots.off_hand}
                onEquip={() => handleEquip("hand_slots.off_hand")}
                onUnequip={() => handleUnequip("hand_slots.off_hand")}
                selectedItem={selectedItem}
              />
            </div>
          </div>

          {/* Body Slots */}
          <div>
            <h4 style={{ color: '#87CEEB', fontSize: '14px', marginBottom: '5px' }}>Body Slots</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <SlotItem
                slotName="Head"
                slotPath="body_slots.head"
                item={bodySlots.head}
                onEquip={() => handleEquip("body_slots.head")}
                onUnequip={() => handleUnequip("body_slots.head")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Face"
                slotPath="body_slots.face"
                item={bodySlots.face}
                onEquip={() => handleEquip("body_slots.face")}
                onUnequip={() => handleUnequip("body_slots.face")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Neck"
                slotPath="body_slots.neck"
                item={bodySlots.neck}
                onEquip={() => handleEquip("body_slots.neck")}
                onUnequip={() => handleUnequip("body_slots.neck")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Torso"
                slotPath="body_slots.torso"
                item={bodySlots.torso}
                onEquip={() => handleEquip("body_slots.torso")}
                onUnequip={() => handleUnequip("body_slots.torso")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Back"
                slotPath="body_slots.back"
                item={bodySlots.back}
                onEquip={() => handleEquip("body_slots.back")}
                onUnequip={() => handleUnequip("body_slots.back")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Waist"
                slotPath="body_slots.waist"
                item={bodySlots.waist}
                onEquip={() => handleEquip("body_slots.waist")}
                onUnequip={() => handleUnequip("body_slots.waist")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Wrists"
                slotPath="body_slots.wrists"
                item={bodySlots.wrists}
                onEquip={() => handleEquip("body_slots.wrists")}
                onUnequip={() => handleUnequip("body_slots.wrists")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Left Finger"
                slotPath="body_slots.left_finger"
                item={bodySlots.left_finger}
                onEquip={() => handleEquip("body_slots.left_finger")}
                onUnequip={() => handleUnequip("body_slots.left_finger")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Right Finger"
                slotPath="body_slots.right_finger"
                item={bodySlots.right_finger}
                onEquip={() => handleEquip("body_slots.right_finger")}
                onUnequip={() => handleUnequip("body_slots.right_finger")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Legs"
                slotPath="body_slots.legs"
                item={bodySlots.legs}
                onEquip={() => handleEquip("body_slots.legs")}
                onUnequip={() => handleUnequip("body_slots.legs")}
                selectedItem={selectedItem}
              />
              <SlotItem
                slotName="Feet"
                slotPath="body_slots.feet"
                item={bodySlots.feet}
                onEquip={() => handleEquip("body_slots.feet")}
                onUnequip={() => handleUnequip("body_slots.feet")}
                selectedItem={selectedItem}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SlotItemProps {
  slotName: string;
  slotPath: string;
  item: string;
  onEquip: () => void;
  onUnequip: () => void;
  selectedItem: string;
}

const SlotItem: React.FC<SlotItemProps> = ({ slotName, slotPath, item, onEquip, onUnequip, selectedItem }) => {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '8px',
      fontSize: '12px'
    }}>
      <div style={{ color: '#888', marginBottom: '4px' }}>{slotName}</div>
      <div style={{
        backgroundColor: item ? '#2a4a2a' : '#2a2a2a',
        border: '1px solid #666',
        borderRadius: '3px',
        padding: '4px',
        minHeight: '20px',
        color: item ? '#90EE90' : '#888',
        fontSize: '11px',
        marginBottom: '4px'
      }}>
        {item || 'Empty'}
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {item ? (
          <button
            onClick={onUnequip}
            style={{
              backgroundColor: '#8B4513',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              flex: 1
            }}
          >
            Unequip
          </button>
        ) : (
          <button
            onClick={onEquip}
            disabled={!selectedItem}
            style={{
              backgroundColor: selectedItem ? '#2E8B57' : '#555',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: selectedItem ? 'pointer' : 'not-allowed',
              flex: 1
            }}
          >
            Equip
          </button>
        )}
      </div>
    </div>
  );
};
