// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.23;

import "../interfaces/IRip7560EntryPoint.sol";
import "../interfaces/IRip7560Transaction.sol";

address constant ENTRY_POINT = 0x0000000000000000000000000000000000007560;

library RIP7560Utils {

    //struct version, as defined in RIP-7560
    uint constant VERSION = 0;

    function decodeTransaction(uint256 version, bytes calldata transaction) internal pure returns (RIP7560Transaction memory) {
        require(version == VERSION, "RIP7560Utils: unsupported version");
        return abi.decode(transaction, (RIP7560Transaction));
    }

    function accountAcceptTransaction(
        uint48 validAfter,
        uint48 validUntil
    ) internal {
        (bool success,) = ENTRY_POINT.call(
            abi.encodeCall(IRip7560EntryPoint.acceptAccount, (validAfter, validUntil))
        );
        require(success);
    }

    function paymasterAcceptTransaction(
        bytes memory context,
        uint256 validAfter,
        uint256 validUntil
    ) internal {
        (bool success,) = ENTRY_POINT.call(
            abi.encodeCall(IRip7560EntryPoint.acceptPaymaster, (validAfter, validUntil, context))
        );
        require(success);
    }
}
