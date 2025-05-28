import React, { useState, useEffect } from 'react';
import './BankGame.css';


const nameEditStyles = `
.editable-name {
  cursor: pointer;
  transition: all 0.2s;
  display: inline-block;
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1em;
  width: 100%;
  max-width: 150px;
  color: #333;
}

.editable-name:hover {
  background-color: rgba(255, 255, 255, 0.2);
}

.name-edit-form {
  display: flex;
  align-items: center;
}

.name-edit-input {
  padding: 3px 6px;
  border-radius: 4px;
  border: 1px solid #ccc;
  font-size: 1em;
  width: 100%;
  max-width: 150px;
  background-color: #fff;
  color: #333;
}

.name-save-button {
  margin-left: 5px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-weight: bold;
}
`;

const BankGame = () => {
  // Init default players
  const initialPlayers = [
    { id: 1, name: 'Player 1', score: 0, banked: false, editingName: false },
    { id: 2, name: 'Player 2', score: 0, banked: false, editingName: false },
  ];
  
  // Game state
  const [players, setPlayers] = useState(initialPlayers);
  const [pot, setPot] = useState(0);
  const [currentRoll, setCurrentRoll] = useState(null);
  const [rollCount, setRollCount] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [round, setRound] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [gameLog, setGameLog] = useState([]);
  const [dice, setDice] = useState([0, 0]);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);

  // Check if round is over (all players banked)
  const isRoundOver = (playersList) => {
    // Fall back to the state
    const playersToCheck = playersList || players;
    return playersToCheck.every(player => player.banked);
  };

  // Add message to log
  const addToLog = (message) => {
    setGameLog(prevLog => [...prevLog, message]);
  };

  // Roll dice
  const rollDice = () => {
    if (gameOver || players[currentPlayer].banked) {
      return;
    }

    setIsRolling(true);
    
    // Dice rolling animation
    const rollInterval = setInterval(() => {
      setDice([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
    }, 50);
    
    // Stop rolling
    setTimeout(() => {
      clearInterval(rollInterval);
      setIsRolling(false);
      
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const total = die1 + die2;
      const isDouble = die1 === die2;
      
      setDice([die1, die2]);
      setCurrentRoll({ die1, die2, total, isDouble });
      
      let newPot = pot;
      const newRollCount = rollCount + 1;
      setRollCount(newRollCount);
      
      // Apply rules based on roll count
      if (newRollCount <= 3) {
        // First three rolls
        if (total === 7) {
          // 7 gives 70 points
          newPot += 70;
          addToLog(`Roll ${newRollCount}: ${die1} + ${die2} = 7! Special rule: +70 points to pot!`);
        } else if (isDouble) {
          // Doubles add face value
          newPot += total;
          addToLog(`Roll ${newRollCount}: Double ${die1}s = ${total} points added to pot`);
        } else {
          // Normal roll
          newPot += total;
          addToLog(`Roll ${newRollCount}: ${die1} + ${die2} = ${total} points added to pot`);
        }
      } else {
        // Fourth roll 
        if (total === 7) {
          // 7 ends the round
          addToLog(`Roll ${newRollCount}: ${die1} + ${die2} = 7! Round over - unbanked points lost!`);
          endRound();
          return;
        } else if (isDouble) {
          // Doubles double the pot
          newPot = newPot * 2;
          addToLog(`Roll ${newRollCount}: Double ${die1}s! Pot doubled to ${newPot}!`);
        } else {
          // Normal roll
          newPot += total;
          addToLog(`Roll ${newRollCount}: ${die1} + ${die2} = ${total} points added to pot`);
        }
      }
      
      setPot(newPot);
      
      // Move to next player
      const nextPlayer = (currentPlayer + 1) % players.length;

      // Skip players who have already banked
      let skipped = 0;
      let newCurrentPlayer = nextPlayer;
      while (skipped < players.length && players[newCurrentPlayer].banked) {
        newCurrentPlayer = (newCurrentPlayer + 1) % players.length;
        skipped++;
      }
      
      // If all players have banked, end the round
      if (skipped >= players.length - 1 && players[newCurrentPlayer].banked) {
        endRound();
      } else {
        setCurrentPlayer(newCurrentPlayer);
      }
    }, 500);
  };

  // Bank the current pot for a player
  const bankPot = (playerId) => {
    if (gameOver) return;
    
    // Update players and check if round is over
    setPlayers(prevPlayers => {
      const updatedPlayers = prevPlayers.map(player => {
        if (player.id === playerId && !player.banked) {
          addToLog(`${player.name} banked ${pot} points!`);
          return { ...player, score: player.score + pot, banked: true };
        }
        return player;
      });
      
      // Check if all players have banked after this update
      if (isRoundOver(updatedPlayers)) {
        // Schedule the endRound call to ensure state has been updated
        setTimeout(() => {
          endRound();
        }, 0);
        return updatedPlayers;
      }
      
      // Move to the next player on bank
      if (players[currentPlayer].id === playerId) {
        // Find the next player who hasn't banked yet
        const playerCount = updatedPlayers.length;
        let nextPlayerIndex = (currentPlayer + 1) % playerCount;
        let skipped = 0;
        
        // Keep looking
        while (skipped < playerCount && updatedPlayers[nextPlayerIndex].banked) {
          nextPlayerIndex = (nextPlayerIndex + 1) % playerCount;
          skipped++;
        }
        
        // Update the current player
        if (skipped < playerCount) {
          setTimeout(() => {
            setCurrentPlayer(nextPlayerIndex);
          }, 0);
        }
      }
      
      return updatedPlayers;
    });
  };

  // End the current round
  const endRound = () => {
    // Check if game over
    if (round >= 10) {
      const maxScore = Math.max(...players.map(player => player.score));
      const winners = players.filter(player => player.score === maxScore);
      setWinner(winners.map(player => player.name).join(', '));
      setGameOver(true);
      addToLog(`Game over! ${winners.map(player => player.name).join(' & ')} won with ${maxScore} points!`);
    } else {
      // Reset
      setPot(0);
      setRollCount(0);
      setCurrentRoll(null);
      setCurrentPlayer(0);
      setRound(prevRound => prevRound + 1);
      setPlayers(prevPlayers => 
        prevPlayers.map(player => ({ ...player, banked: false }))
      );
      addToLog(`Round ${round} ended. Starting round ${round + 1}!`);
    }
  };

  // Start a new game
  const resetGame = () => {
    setPot(0);
    setRollCount(0);
    setCurrentRoll(null);
    setCurrentPlayer(0);
    setRound(1);
    setGameOver(false);
    setGameLog([]);
    setDice([0, 0]);
    setWinner(null);
    setPlayers(prevPlayers => 
      prevPlayers.map(player => ({ 
        ...player, 
        score: 0, 
        banked: false,
        editingName: false 
      }))
    );
    addToLog('New game started!');
  };
  
  // Add a new player
  const addPlayer = () => {
    if (gameOver || round > 1) {
      alert("Can't add players after the game has started. Please reset the game first.");
      return;
    }
    
    const newPlayerId = players.length > 0 ? Math.max(...players.map(p => p.id)) + 1 : 1;
    const newPlayer = {
      id: newPlayerId,
      name: `Player ${newPlayerId}`,
      score: 0,
      banked: false,
      editingName: false
    };
    
    setPlayers([...players, newPlayer]);
    addToLog(`${newPlayer.name} joined the game!`);
  };
  
  // Remove a player
  const removePlayer = (playerId) => {
    if (gameOver || round > 1) {
      alert("Can't remove players after the game has started. Please reset the game first.");
      return;
    }
    
    // You need two players to play a game dumbass
    if (players.length <= 2) {
      alert("Must have at least 2 players in the game.");
      return;
    }
    
    const playerToRemove = players.find(p => p.id === playerId);
    setPlayers(players.filter(p => p.id !== playerId));
    addToLog(`${playerToRemove.name} left the game.`);
    
    // Adjust currentPlayer if needed
    if (currentPlayer >= players.length - 1) {
      setCurrentPlayer(0);
    }
  };

  // Toggle name editing mode for a player
  const toggleNameEdit = (playerId) => {
    if (gameOver || round > 1) {
      alert("Can't edit names after the game has started. Please reset the game first.");
      return;
    }
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => 
        player.id === playerId 
          ? { ...player, editingName: !player.editingName }
          : { ...player, editingName: false }
      )
    );
  };
  
  // Update player name
  const updatePlayerName = (playerId, newName) => {
    if (!newName.trim()) {
      alert("Player name cannot be empty!");
      return;
    }
    
    setPlayers(prevPlayers => 
      prevPlayers.map(player => {
        if (player.id === playerId) {
          const oldName = player.name;
          addToLog(`"${oldName}" changed name to "${newName}"`);
          return { ...player, name: newName, editingName: false };
        }
        return player;
      })
    );
  };

  // Render dice faces
  const renderDiceFace = (value) => {
    const createDot = (position) => {
      let style = {};
      
      switch(position) {
        case 'center':
          style = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
          break;
        case 'top-left':
          style = { top: '25%', left: '25%' };
          break;
        case 'top-right':
          style = { top: '25%', right: '25%' };
          break;
        case 'middle-left':
          style = { top: '50%', left: '25%', transform: 'translateY(-50%)' };
          break;
        case 'middle-right':
          style = { top: '50%', right: '25%', transform: 'translateY(-50%)' };
          break;
        case 'bottom-left':
          style = { bottom: '25%', left: '25%' };
          break;
        case 'bottom-right':
          style = { bottom: '25%', right: '25%' };
          break;
        default:
          break;
      }
      
      return <div className="dot" style={style} />;
    };
    
    const dots = [];
    
    // Create dot positions based on dice value
    switch (value) {
      case 1:
        dots.push(<div key="center" className="dot" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />);
        break;
      case 2:
        dots.push(<div key="top-right" className="dot" style={{ top: '25%', right: '25%' }} />);
        dots.push(<div key="bottom-left" className="dot" style={{ bottom: '25%', left: '25%' }} />);
        break;
      case 3:
        dots.push(<div key="top-right" className="dot" style={{ top: '25%', right: '25%' }} />);
        dots.push(<div key="center" className="dot" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />);
        dots.push(<div key="bottom-left" className="dot" style={{ bottom: '25%', left: '25%' }} />);
        break;
      case 4:
        dots.push(<div key="top-left" className="dot" style={{ top: '25%', left: '25%' }} />);
        dots.push(<div key="top-right" className="dot" style={{ top: '25%', right: '25%' }} />);
        dots.push(<div key="bottom-left" className="dot" style={{ bottom: '25%', left: '25%' }} />);
        dots.push(<div key="bottom-right" className="dot" style={{ bottom: '25%', right: '25%' }} />);
        break;
      case 5:
        dots.push(<div key="top-left" className="dot" style={{ top: '25%', left: '25%' }} />);
        dots.push(<div key="top-right" className="dot" style={{ top: '25%', right: '25%' }} />);
        dots.push(<div key="center" className="dot" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />);
        dots.push(<div key="bottom-left" className="dot" style={{ bottom: '25%', left: '25%' }} />);
        dots.push(<div key="bottom-right" className="dot" style={{ bottom: '25%', right: '25%' }} />);
        break;
      case 6:
        dots.push(<div key="top-left" className="dot" style={{ top: '25%', left: '25%' }} />);
        dots.push(<div key="top-right" className="dot" style={{ top: '25%', right: '25%' }} />);
        dots.push(<div key="middle-left" className="dot" style={{ top: '50%', left: '25%', transform: 'translateY(-50%)' }} />);
        dots.push(<div key="middle-right" className="dot" style={{ top: '50%', right: '25%', transform: 'translateY(-50%)' }} />);
        dots.push(<div key="bottom-left" className="dot" style={{ bottom: '25%', left: '25%' }} />);
        dots.push(<div key="bottom-right" className="dot" style={{ bottom: '25%', right: '25%' }} />);
        break;
      default:
        break;
    }
    
    return (
      <div className="die">
        {dots}
      </div>
    );
  };

  useEffect(() => {
    // Initialize game log
    addToLog('Game started! Roll the dice to begin.');
    
    // Dumb fix, it works tho
    const styleElement = document.createElement('style');
    styleElement.textContent = nameEditStyles;
    document.head.appendChild(styleElement);
    
    // Clean up 
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className="game-container">
      <div className="game-header">
        <h1 className="game-title">Bank Game</h1>
        <div className="game-info">
          <span>Round: {round}/10</span> | 
          <span>Current Pot: {pot} points</span>
        </div>
      </div>
      
      
      
      {gameOver ? (
        <div className="game-over-container">
          <h2 className="game-over-title">Game Over!</h2>
          <p className="winner-text">Winner: {winner}</p>
          <button 
            onClick={resetGame}
            className="play-again-button"
          >
            Play Again
          </button>
        </div>
      ) : (
        <div className="dice-area">
          <div className="dice-container">
            {renderDiceFace(dice[0])}
            {renderDiceFace(dice[1])}
          </div>
          
          <p>
            Current player: <strong>{players[currentPlayer].name}</strong>
          </p>
          
          <div>
            <button 
              onClick={rollDice}
              disabled={isRolling || players[currentPlayer].banked}
              className="roll-button"
            >
              {isRolling ? 'Rolling...' : 'Roll Dice'}
            </button>
          </div>
        </div>
      )}
      
      <div className="player-row">
        {players.map(player => (
          <div 
            key={player.id} 
            className={`player-card ${currentPlayer === players.indexOf(player) && !gameOver ? 'active' : ''}`}
          >
            <div className="player-header">
              <h3 className="player-name">
                {player.editingName ? (
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.target.elements.playerName;
                      updatePlayerName(player.id, input.value);
                    }}
                    className="name-edit-form"
                  >
                    <input 
                      name="playerName"
                      type="text" 
                      defaultValue={player.name}
                      autoFocus
                      className="name-edit-input"
                    />
                    <button type="submit" className="name-save-button">✓</button>
                  </form>
                ) : (
                  <span 
                    onClick={() => round === 1 && !gameOver ? toggleNameEdit(player.id) : null}
                    className={round === 1 && !gameOver ? "editable-name" : ""}
                    title={round === 1 && !gameOver ? "Click to edit name" : ""}
                  >
                    {player.name}
                  </span>
                )}
              </h3>
              <span className="player-score">{player.score} points</span>
            </div>
            
            <div className="player-status">
              <span className={`banked-status ${player.banked ? 'is-banked' : ''}`}>
                {player.banked ? 'BANKED' : 'Not banked'}
              </span>
              
              <div className="player-buttons">
                <button 
                  onClick={() => bankPot(player.id)}
                  disabled={player.banked || gameOver}
                  className="bank-button"
                >
                  BANK!
                </button>
                
                {round === 1 && !gameOver && (
                  <button 
                    onClick={() => removePlayer(player.id)}
                    className="remove-player-button"
                    disabled={players.length <= 2}
                    title="Remove Player"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Player management section */}
      <div className="player-management">
        <h3>Players ({players.length})</h3>
        <div className="player-controls">
          <button 
            onClick={addPlayer}
            className="add-player-button"
            disabled={gameOver || round > 1}
          >
            Add Player
          </button>
          <button 
            onClick={resetGame}
            className="reset-button"
          >
            Reset Game
          </button>
        </div>
      </div>
      
      <div className="game-log">
        <h3 className="log-title">Game Log</h3>
        <div className="log-container">
          {gameLog.map((log, index) => (
            <p key={index} className="log-entry">
              {log}
            </p>
          ))}
        </div>
      </div>
      
      <div className="rules-container">
        <h3 className="rules-title">Game Rules</h3>
        <div className="rules-content">
          <p><strong>Basic Concepts:</strong> The pot accumulates points. Players can bank to claim points. Round ends when someone rolls a 7 or all players bank.</p>
          <p><strong>First Three Rolls:</strong> 7 = 70 points, doubles = sum of dice, other rolls = sum added to pot.</p>
          <p><strong>Fourth Roll Onward:</strong> 7 = round ends (unbanked points lost), doubles = pot doubles, other rolls = sum added to pot.</p>
          <p><strong>Banking:</strong> Bank anytime to secure points. Once banked, can't roll or bank again in the round. Multiple players can bank the same pot.</p>
        </div>
      </div>
    </div>
  );
};

export default BankGame;