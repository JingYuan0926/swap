// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/core/StakeManager.sol";
import "../interfaces/IRip7560StakeManager.sol";

contract Rip7560StakeManager is StakeManager, IRip7560StakeManager {

    // internal method to return just the stake info
    function getStakeInfo(address[] calldata accounts) public view returns (StakeInfo[] memory) {
        StakeInfo[] memory infos = new StakeInfo[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) {
            infos[i] = _getStakeInfo(accounts[i]);
        }
        return infos;
    }
}
