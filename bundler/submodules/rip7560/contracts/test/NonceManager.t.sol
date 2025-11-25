// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

// Testing utilities
import { Test } from "forge-std/Test.sol";
import "../predeploys/NonceManager.sol";

contract NonceManagerTest is Test {
    address private constant aaEntryPoint = 0x0000000000000000000000000000000000007560;
    address private constant alice = 0x0000000000000000000000000000000000007777;
    uint256 public aliceKey;
    error InvalidLength();
    NonceManager public nonceManager;

    /// @dev Sets up the test suite.
    function setUp() public virtual {
        nonceManager = new NonceManager();
        aliceKey = uint256(3);
    }

    /// @dev Tests that increasing nonce is done properly.
    function test_validateIncrement_succeeds() public {
        vm.prank(aaEntryPoint);
        (bool success, bytes memory returnData) =
                                address(nonceManager).call(abi.encodePacked(alice, aliceKey, uint256(0)));
        assertTrue(success);
        assertEq(returnData, new bytes(0));
    }

    /// @dev Tests that increasing nonce with invalid nonce fails.
    function test_validateIncrement_invalidNonce_fails() external {
        vm.prank(aaEntryPoint);
        (bool success,) = address(nonceManager).call(abi.encodePacked(alice, aliceKey, uint256(1)));
        assertFalse(success);
    }

    /// @dev Tests that getting nonce through fallback is done properly.
    function test_fallback_get_succeeds() external {
        (bool success, bytes memory returnData) = address(nonceManager).call(abi.encodePacked(alice, aliceKey));
        assertTrue(success);
        assertEq(returnData, abi.encodePacked(uint256(0)));

        test_validateIncrement_succeeds();

        (success, returnData) = address(nonceManager).call(abi.encodePacked(alice, aliceKey));
        assertTrue(success);
        assertEq(returnData, abi.encodePacked(uint256(1)));
    }

    /// @dev Tests that getting nonce with invalid length fails.
    function test_fallback_get_invalidLength_fails() external {
        vm.expectRevert(InvalidLength.selector);
        (bool success,) = address(nonceManager).call(abi.encodePacked(alice, aliceKey, uint256(1)));
        (success); // silence unused variable warning
    }

    /// @dev Fuzz test for validateIncrement function.
    function testFuzz_validateIncrement_succeeds(uint256 n) external {
        bool success;
        bytes memory returnData;

        n = n % 1000; // limit the number of iterations to prevent OOG
        for (uint256 i = 0; i < n; i++) {
            vm.prank(aaEntryPoint);
            (success,) = address(nonceManager).call(abi.encodePacked(alice, aliceKey, uint256(i)));
            assertTrue(success);
        }

        (success, returnData) = address(nonceManager).call(abi.encodePacked(alice, aliceKey));
        assertTrue(success);
        assertEq(returnData, abi.encodePacked(uint256(n)));
    }
}
