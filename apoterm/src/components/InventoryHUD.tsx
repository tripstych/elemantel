import React, { useState, useEffect } from 'react';
import { gameClient } from '../services/GameClient';
import { convertToCuneiform } from '../utils/CuneiformUtils';

interface InventoryHUDProps {
  isVisible: boolean;
  onClose: () => void;
  playerState: any;
}

export const InventoryHUD: React.FC<InventoryHUDProps> = ({ isVisible, onClose, playerState }) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [message, setMessage] = useState<string>('');
  const [inspectItem, setInspectItem] = useState<any | null>(null);

  useEffect(() => {
    // Set up equip/unequip result listeners
    gameClient.onEquipResult((result: any) => {
      setMessage(result.message || 'Item equipped!');
      setSelectedIndex(-1); // Clear selection when equip succeeds
      setTimeout(() => setMessage(''), 3000);
    });

    gameClient.onUnequipResult((result: any) => {
      setMessage(result.message || 'Item unequipped!');
      setTimeout(() => setMessage(''), 3000);
    });

    // Set up item inspect listener
    gameClient.onLanguageEntryResult((result: any) => {
      if (result.entry) {
        // Add the synset key to the entry for display purposes
        setInspectItem({
          ...result.entry,
          synsetKey: result.key
        });
      } else {
        // Item not found, show fallback
        setInspectItem({
          synsetKey: result.key,
          word: result.key,
          type: 'unknown',
          definition: 'Item not found in database',
          weight: 0,
          origin: { fire: 0, water: 0, earth: 0, air: 0 },
          composition: { fire: 0, water: 0, earth: 0, air: 0 },
          spell_effect: { type: '', amount: '', target: '', element: '', description: '' },
          spirit: 'None'
        });
      }
    });

    return () => {
      // Cleanup would go here if needed
    };
  }, []);

  if (!isVisible || !playerState) return null;

  const inventory = Array.isArray(playerState.inventory) ? playerState.inventory : [];
  
  // Debug logging
  console.log("InventoryHUD - playerState:", playerState);
  console.log("InventoryHUD - inventory type:", typeof playerState.inventory);
  console.log("InventoryHUD - inventory:", playerState.inventory);
  console.log("InventoryHUD - isArray:", Array.isArray(playerState.inventory));
  
  const slots = playerState.slots || {};
  const handSlots = slots.hand_slots || {};
  const bodySlots = slots.body_slots || {};
  
  // Debug logging for slots
  console.log("InventoryHUD - slots:", slots);
  console.log("InventoryHUD - handSlots:", handSlots);
  console.log("InventoryHUD - bodySlots:", bodySlots);
  console.log("InventoryHUD - main_hand:", handSlots.main_hand);
  console.log("InventoryHUD - off_hand:", handSlots.off_hand);

  const handleEquip = (slotPath: string) => {
    if (selectedIndex === -1) {
      setMessage('Select an item first!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    const selectedItem = inventory[selectedIndex];
    if (!selectedItem) {
      setMessage('Invalid item selection!');
      setTimeout(() => setMessage(''), 2000);
      return;
    }
    
    gameClient.equipItem(slotPath, selectedItem);
    setMessage(`Equipping ${selectedItem} to ${slotPath}...`);
  };

  const handleUnequip = (slotPath: string) => {
    gameClient.unequipItem(slotPath);
    setMessage(`Unequipping from ${slotPath}...`);
  };

  const handleDrop = (itemName: string) => {
    gameClient.dropItem(itemName);
    setMessage(`Dropping ${itemName}...`);
  };

  const handleInspect = (itemName: string) => {
    // Request item details from server
    gameClient.getLanguageEntry(itemName);
    setMessage(`Inspecting ${itemName}...`);
    setTimeout(() => setMessage(''), 2000);
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
                  onClick={() => setSelectedIndex(index)}
                  style={{
                    padding: '8px',
                    margin: '2px 0',
                    backgroundColor: selectedIndex === index ? '#4a4a4a' : '#2a2a2a',
                    border: selectedIndex === index ? '1px solid #gold' : '1px solid #555',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>{item}</span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInspect(item);
                      }}
                      style={{
                        backgroundColor: '#4169E1',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        padding: '2px 6px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Inspect
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDrop(item);
                      }}
                      style={{
                        backgroundColor: '#8B0000',
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
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Off Hand"
                slotPath="hand_slots.off_hand"
                item={handSlots.off_hand}
                onEquip={() => handleEquip("hand_slots.off_hand")}
                onUnequip={() => handleUnequip("hand_slots.off_hand")}
                selectedIndex={selectedIndex}
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
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Face"
                slotPath="body_slots.face"
                item={bodySlots.face}
                onEquip={() => handleEquip("body_slots.face")}
                onUnequip={() => handleUnequip("body_slots.face")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Neck"
                slotPath="body_slots.neck"
                item={bodySlots.neck}
                onEquip={() => handleEquip("body_slots.neck")}
                onUnequip={() => handleUnequip("body_slots.neck")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Torso"
                slotPath="body_slots.torso"
                item={bodySlots.torso}
                onEquip={() => handleEquip("body_slots.torso")}
                onUnequip={() => handleUnequip("body_slots.torso")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Back"
                slotPath="body_slots.back"
                item={bodySlots.back}
                onEquip={() => handleEquip("body_slots.back")}
                onUnequip={() => handleUnequip("body_slots.back")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Waist"
                slotPath="body_slots.waist"
                item={bodySlots.waist}
                onEquip={() => handleEquip("body_slots.waist")}
                onUnequip={() => handleUnequip("body_slots.waist")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Wrists"
                slotPath="body_slots.wrists"
                item={bodySlots.wrists}
                onEquip={() => handleEquip("body_slots.wrists")}
                onUnequip={() => handleUnequip("body_slots.wrists")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Left Finger"
                slotPath="body_slots.left_finger"
                item={bodySlots.left_finger}
                onEquip={() => handleEquip("body_slots.left_finger")}
                onUnequip={() => handleUnequip("body_slots.left_finger")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Right Finger"
                slotPath="body_slots.right_finger"
                item={bodySlots.right_finger}
                onEquip={() => handleEquip("body_slots.right_finger")}
                onUnequip={() => handleUnequip("body_slots.right_finger")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Legs"
                slotPath="body_slots.legs"
                item={bodySlots.legs}
                onEquip={() => handleEquip("body_slots.legs")}
                onUnequip={() => handleUnequip("body_slots.legs")}
                selectedIndex={selectedIndex}
              />
              <SlotItem
                slotName="Feet"
                slotPath="body_slots.feet"
                item={bodySlots.feet}
                onEquip={() => handleEquip("body_slots.feet")}
                onUnequip={() => handleUnequip("body_slots.feet")}
                selectedIndex={selectedIndex}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inspection Modal */}
      {inspectItem && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: '#1a1a1a',
          border: '2px solid #gold',
          borderRadius: '8px',
          padding: '20px',
          minWidth: '400px',
          maxWidth: '600px',
          maxHeight: '80vh',
          overflowY: 'auto',
          zIndex: 1000
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#gold' }}>
              Item Inspection: {inspectItem.synsetKey ? inspectItem.synsetKey.substr(0, inspectItem.synsetKey.indexOf('.')) : 'Unknown'}
            </h3>
            <button 
              onClick={() => setInspectItem(null)}
              style={{
                backgroundColor: '#8B4513',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer'
              }}
            >
              X
            </button>
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px' }}>
              <strong style={{ color: '#gold' }}>Basic Info:</strong>
              <div style={{ marginTop: '5px' }}>
                <div><strong>Word:</strong> {inspectItem.word}</div>
                <div><strong>Type:</strong> {inspectItem.type}</div>
                <div><strong>Weight:</strong> {inspectItem.weight}</div>
                <div><strong>Definition:</strong> {inspectItem.definition}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px' }}>
              <strong style={{ color: '#gold' }}>Origin:</strong>
              <div style={{ marginTop: '5px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <div><strong>Fire:</strong> {convertToCuneiform(inspectItem.origin?.fire || 0)}</div>
                <div><strong>Water:</strong> {convertToCuneiform(inspectItem.origin?.water || 0)}</div>
                <div><strong>Earth:</strong> {convertToCuneiform(inspectItem.origin?.earth || 0)}</div>
                <div><strong>Air:</strong> {convertToCuneiform(inspectItem.origin?.air || 0)}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px' }}>
              <strong style={{ color: '#gold' }}>Spell Effect:</strong>
              <div style={{ marginTop: '5px' }}>
                <div><strong>Type:</strong> {inspectItem.spell_effect?.type || 'None'}</div>
                <div><strong>Target:</strong> {inspectItem.spell_effect?.target || 'None'}</div>
                <div><strong>Amount:</strong> {inspectItem.spell_effect?.amount || 'None'}</div>
                <div><strong>Element:</strong> {inspectItem.spell_effect?.element || 'None'}</div>
                <div><strong>Description:</strong> {inspectItem.spell_effect?.description || 'None'}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#2a2a2a', padding: '10px', borderRadius: '4px' }}>
              <strong style={{ color: '#gold' }}>Spirit:</strong> {inspectItem.spirit || 'None'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface SlotItemProps {
  slotName: string;
  slotPath: string;
  item: string;
  onEquip: () => void;
  onUnequip: () => void;
  selectedIndex: number;
}

const SlotItem: React.FC<SlotItemProps> = ({ slotName, slotPath, item, onEquip, onUnequip, selectedIndex }) => {
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
            disabled={selectedIndex === -1}
            style={{
              backgroundColor: selectedIndex !== -1 ? '#2E8B57' : '#555',
              color: 'white',
              border: 'none',
              borderRadius: '2px',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: selectedIndex !== -1 ? 'pointer' : 'not-allowed',
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
