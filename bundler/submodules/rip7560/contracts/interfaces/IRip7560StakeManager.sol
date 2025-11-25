// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import "@account-abstraction/contracts/interfaces/IStakeManager.sol";

interface IRip7560StakeManager is IStakeManager {

    // internal method to return just the stake info
    function getStakeInfo(address[] calldata accounts) external view returns (StakeInfo[] memory infos);
}
