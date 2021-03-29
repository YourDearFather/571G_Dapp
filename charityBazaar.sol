// SPDX-License-Identifier: MIT
// Author: Xiaoan Sun

pragma solidity ^0.7.6;

contract CharityBazaar{

    // The owner is the charity
    address payable public _owner;
    // The item ID counter
    uint public idCounter = 1;

    // The registered User list
    address[] public registeredUser;
    uint public userCounter = 0;

    // The highest price for each item
    mapping (uint => address) public itemHighestPrice;

    // The minimal donate amount
    uint public minimalDonateAmount = 1 ether;

    // Whether any order remains to be confirmed
    bool public isAnyOrderPending = false;

    constructor() payable{

        _owner = msg.sender;

    }

    // The Item that waiting for auction
    struct CharityItem{
        string itemName;
        uint price;
        bool isItemSold;
        address owner;

    }

    // The order created by buyer
    struct AuctionOrder{
        bool isValidOrder;
        uint itemID;
        uint price;
        bool hasConfirmed;

    }

    // The credit system
    struct credit{
        bool isUserExisted;
        uint creditRest;
    }

    // order list
    mapping (address=> AuctionOrder) public orderList;
    // Item list
    mapping (uint => CharityItem) public itemList;
    // Credit list
    mapping (address=> credit) public creditList;


    // Used to make contract receive ether
    receive() external payable {}

    // The charity will create Item and release it to the market
    function createItem(string memory _itemName, uint _price) public
    onlyOwner(){
        require(bytes(_itemName).length != 0,"Please input the item name");
        require(_price > 0,"Please input a valid price");
        itemList[idCounter].itemName = _itemName;
        itemList[idCounter].price = _price* (1 ether);
        itemList[idCounter].isItemSold = false;
        itemList[idCounter].owner = _owner;
        itemHighestPrice[idCounter] = _owner;
        idCounter += 1;

    }

    // Bid the item that is not sold
    function bidItem(uint _itemID, uint _bidPrice) public payable
    isOrderCompleted(orderList[msg.sender])
    isItemSold(itemList[_itemID]){



        uint givenPrice = _bidPrice * (1 ether);
        require(_itemID >0 && _itemID < idCounter,"Please input an valid item ID");
        require(givenPrice>= itemList[_itemID].price,"You should offer a price higher than the default price!");
        address payable addressUser = msg.sender;

        checkFirstUser(addressUser);

        require(creditList[addressUser].creditRest > 0,
            "You do not have enough credit, you are already in the blacklist! Donate to earn extra credit");

        // Pay ether
        require(msg.value >= givenPrice,"You have not paid enough ether");
        address(this).transfer(givenPrice);
        addressUser.transfer(msg.value - givenPrice);

        // Create an order
        orderList[addressUser].isValidOrder = true;
        orderList[addressUser].itemID = _itemID;
        orderList[addressUser].price = _bidPrice;
        orderList[addressUser].hasConfirmed = false;

        isAnyOrderPending = true;
    }

    // Buyer can cancel the order if the order has not been confirmed yet. This will cost 1 credit as punishment
    function cancelOrder() public payable
    isPending(orderList[msg.sender]){
        address payable addressUser = msg.sender;
        require(orderList[addressUser].hasConfirmed == false,"The order has already confirmed");
        orderList[addressUser].isValidOrder = false;
        uint refund = orderList[addressUser].price * (1 ether);
        addressUser.transfer(refund);

        // Decrease 1 credit as punishment
        creditList[addressUser].creditRest -= 1;

    }

    // The charity will confirm the order to finish all existing deal
    function confirm() public payable
    onlyOwner(){
        require (isAnyOrderPending,"No order under pending");

        // Used to store the highest price
        uint [] storage itemUnderBid;
        itemUnderBid.push(0);
        // Loop over each item
        for (uint itemID = 1; itemID <= idCounter; itemID++){
            itemUnderBid.push(0);
            // Check if the item has already been sold
            if(itemList[itemID].isItemSold == false){
                // Loop over all existing user to check their order, find the highest bidding price for each item
                for (uint j = 0; j < registeredUser.length; j++){
                    // extract the order from mapping by the address
                    address currentAddress = registeredUser[j];
                    AuctionOrder memory order = orderList[currentAddress];
                    // Check whether the order existing is valid and the item ID is matched
                    if (order.isValidOrder == true && order.itemID == itemID){
                        // If the price offered in the order is higher than the current highest price, record the new address and price
                        if (order.price >  itemUnderBid[itemID]){
                            // Refund the bidding to last highest user keeper
                            if (itemHighestPrice[itemID] != _owner){
                                uint refund = orderList[itemHighestPrice[itemID]].price * (1 ether);
                                address payable addressRefund  = payable(address(itemHighestPrice[itemID]));
                                addressRefund.transfer(refund);
                            }
                            itemHighestPrice[itemID] = currentAddress;
                            itemUnderBid[itemID] = order.price;
                        }
                        // If the price fails to bid, refund the ether to the corresponding buyer;
                        else {
                            uint refund = order.price * (1 ether);
                            address payable addressRefund  = payable(address(currentAddress));
                            addressRefund.transfer(refund);
                        }

                        // Change the order state
                        orderList[currentAddress].isValidOrder = false;
                        orderList[currentAddress].hasConfirmed = true;
                    }
                }

                // change the item state if there's any one succeed in bidding;
                if (itemHighestPrice[itemID] != _owner){
                    itemList[itemID].isItemSold = true;
                    itemList[itemID].owner = itemHighestPrice[itemID];
                    // Give one credit as reward
                    creditList[itemHighestPrice[itemID]].creditRest += 1;
                }
            }
        }
        isAnyOrderPending = false;

        // The _owner will change after confirm, the reason is still unknown
        _owner = msg.sender;
    }

    function donate(uint _donatePrice) public payable{
        uint givenPrice = _donatePrice * (1 ether);
        require(givenPrice >= minimalDonateAmount,"Please donate at least 1 ether each time");
        address payable addressUser = msg.sender;

        checkFirstUser(addressUser);

        // Pay ether
        require(msg.value >= givenPrice,"You have not paid enough ether");
        address(this).transfer(givenPrice);
        addressUser.transfer(msg.value - givenPrice);
        creditList[addressUser].creditRest += 1;
    }


    // Check if this is a new user. If it is, give the user 3 default credit;
    function checkFirstUser(address userAddress) public{
        address addressUser = userAddress;
        if(creditList[addressUser].isUserExisted == false){
            registeredUser.push(addressUser);
            creditList[addressUser].isUserExisted = true;
            creditList[addressUser].creditRest = 3;
        }
    }

    function withdraw() external onlyOwner {
        _owner.transfer(address(this).balance);
    }

    function balanceOfUser() public view returns (uint256) {
        return msg.sender.balance;
    }

    function balanceOfContract() public view returns (uint256) {
        return address(this).balance;
    }

    function balanceOfOwner() public view returns (uint256) {
        return _owner.balance;
    }

    modifier onlyOwner {
        require(msg.sender == _owner, "Function can only be call by the owner.");
        _;
    }

    modifier isOrderCompleted (AuctionOrder memory order){
        require(order.hasConfirmed == order.isValidOrder || order.hasConfirmed ==true,
            "Order not complete");
        _;
    }

    modifier isItemSold(CharityItem memory item){
        require(!item.isItemSold,"The item has already been sold ");
        _;
    }

    modifier isPending(AuctionOrder memory order){
        require(order.isValidOrder == true && order.hasConfirmed ==false, "No order pending");
        _;
    }

}