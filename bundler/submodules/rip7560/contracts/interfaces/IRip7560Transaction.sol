// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

struct RIP7560Transaction {
    address sender;
    uint256 nonceKey;
    uint256 nonceSequence;
    uint256 validationGasLimit;
    uint256 paymasterValidationGasLimit;
    uint256 postOpGasLimit;
    uint256 callGasLimit;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    uint256 builderFee;
    address paymaster;
    bytes paymasterData;
    address deployer;
    bytes deployerData;
    bytes executionData;
    bytes authorizationData;
}
