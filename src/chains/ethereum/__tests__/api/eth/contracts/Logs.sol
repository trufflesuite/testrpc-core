// SPDX-License-Identifier: MIT
pragma solidity ^0.7.4;

contract Logs {
  event Event(uint indexed first, uint indexed second);
  constructor() {
    emit Event(1, 2);
  }

  function logNTimes (uint8 n) public {
    for (uint8 i = 0; i < n; i++){
      emit Event(i, i);
    }
  }
}
