const CharityBazaar = artifacts.require("CharityBazaar");
require('chai')
.use(require('chai-as-promised'))
.should();
contract("CharityBazaar",(accounts)=>{

    const charity = accounts[0];
    const bidder_1 = accounts[1];
    const bidder_2 = accounts[2];
    const bidder_3 = accounts[3];
    const price = web3.utils.toWei("0.01","Ether");

    before(async () =>{//Always do first
        charityBazaar = await CharityBazaar.new({from:charity});
        const contractAddress = charityBazaar.address;
        console.log("deployer: " + charity);
        console.log("bidder_1: " + bidder_1);
        console.log("bidder_2: " + bidder_2);
        console.log("bidder_3: " + bidder_3);
        console.log("price: " + price);

    });
    describe('Create item test', async()=>{
        it('The item name can not be empty', async() => {
            await charityBazaar.createItem("",2,{from:charity}).should.be.rejected;
        });
        it('The price should be larger than 0 and not empty', async() => {
            await charityBazaar.createItem("item 1",0,{from:charity}).should.be.rejected;
        });
        it('Only charity can create an item', async() => {
            await charityBazaar.createItem("item 1",2,{from:bidder_1}).should.be.rejected;
        });
        it('The item can be created if these is no issue', async() => {
            await charityBazaar.createItem("item 1",2,{from:charity});
            await charityBazaar.createItem("item 2",3,{from:charity});
        });

    });

    describe('Bid item test', async()=>{
        it('The ID should not be empty, 0 or not invalid', async() => {
            await charityBazaar.bidItem(0,10,{from:bidder_1,
                                        value:web3.utils.toWei("10","Ether")}).should.be.rejected;
            await charityBazaar.bidItem("",10,{from:bidder_1,
                                        value:web3.utils.toWei("10","Ether")}).should.be.rejected;
            await charityBazaar.bidItem(1000,10,{from:bidder_1,
                                        value:web3.utils.toWei("10","Ether")}).should.be.rejected;
        });
        it('The bidPrice should be higher than the default price given with the item', async() => {
            await charityBazaar.bidItem(1,1,{from:bidder_1,
                                        value:web3.utils.toWei("10","Ether")}).should.be.rejected;
        });
        it('The bidder should not have any order under bidding', async() => {
            await charityBazaar.bidItem(1,2,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")});
            await charityBazaar.bidItem(2,4,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")}).should.be.rejected;
            // Cancel the order in order not to affect the following tests
            // This cost 1 credit (now credit(bidder_1) = 2)
            await charityBazaar.cancelOrder({from:bidder_1});
        });
        it('The buyer can not make any order if he/she has no credit', async() => {
             await charityBazaar.bidItem(1,2,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")});
             await charityBazaar.cancelOrder({from:bidder_1});
             await charityBazaar.bidItem(1,2,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")});
             await charityBazaar.cancelOrder({from:bidder_1});
             // After 3 times cancel, the bidder_1 should not have any credit remain.
             await charityBazaar.bidItem(1,2,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")}).should.be.rejected;

        });
        it('The bidder cannot bid for item that sold', async() => {
            // Ensure that bidder_1 has at least 1 credit
            await charityBazaar.donate(1,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")})
            // Sell the item_1
            await charityBazaar.bidItem(1,2,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")});
            await charityBazaar.confirm({from:charity});

            await charityBazaar.bidItem(1,3,{from:bidder_2,
                                         value:web3.utils.toWei("10","Ether")}).should.be.rejected;
        });
        it('The given ether should be higher than the bidPrice', async() => {
            await charityBazaar.createItem("item 3",3,{from:charity});
            await charityBazaar.bidItem(3,3,{from:bidder_2,
                                         value:web3.utils.toWei("2","Ether")}).should.be.rejected;
        });
        it('Create the order if there is no issue', async() => {
            await charityBazaar.bidItem(3,3,{from:bidder_2,
                                         value:web3.utils.toWei("4","Ether")});
        });
    });

    describe('Cancel order test', async()=>{
        it('The order cannot be cancelled if it has already been confirmed', async() => {
            await charityBazaar.bidItem(3,5,{from:bidder_3,
                                         value:web3.utils.toWei("5","Ether")});
            await charityBazaar.confirm({from:charity});
            await charityBazaar.cancelOrder({from:bidder_3}).should.be.rejected;
        });
        it('The money should be refunded to bidder after cancelling', async() => {
            await charityBazaar.createItem("item 4",4,{from:charity});
            let balanceBeforeOrder = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));
            await charityBazaar.bidItem(4,4,{from:bidder_1,
                                         value:web3.utils.toWei("4","Ether")});
            let balanceAfterOrder = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));
            await charityBazaar.cancelOrder({from:bidder_1});
            let balanceAfterCancel = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));

             // Since there's gas fee for calling the cancel/order function,
             // the balance after cancelling will be subtly smaller than original.
             // Therefore I use substring to ignore the gas fee.
             assert.equal(balanceBeforeOrder.toString().substring(0,10),
                          balanceAfterCancel.toString().substring(0,10),
                          "The money should be refunded after cancelling")

        });
        it('The bidder should cost 1 credit as punishment for each cancelling', async() => {
            let creditBeforeCancel = (await charityBazaar.creditList.call(bidder_1)).creditRest;
            await charityBazaar.bidItem(4,4,{from:bidder_1,
                                         value:web3.utils.toWei("4","Ether")});
            await charityBazaar.cancelOrder({from:bidder_1});
            let creditAfterCancel = (await charityBazaar.creditList.call(bidder_1)).creditRest;
//            console.log("creditBeforeCancel: "+ creditBeforeCancel);
//            console.log("creditAfterCancel: "+ creditAfterCancel);
            assert.equal(creditBeforeCancel-1,creditAfterCancel,"The credit should decrease 1")
        });
        it('Cancel the order if these is no issue', async() => {
            // Ensure that bidder_1 has at least 1 credit
            await charityBazaar.donate(1,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")})
            await charityBazaar.bidItem(4,4,{from:bidder_1,
                                         value:web3.utils.toWei("4","Ether")});
            await charityBazaar.cancelOrder({from:bidder_1});
        });



    });

    describe('Confirm order test', async()=>{
        it('Charity cannot confirm if these is no order pending', async() => {
            // Clear all existing order
            await charityBazaar.confirm({from:charity});

            await charityBazaar.confirm({from:charity}).should.be.rejected;
        });
        it('The bidder with the highest price will get the item, the rest bidder will get the refund', async() => {
            // Create a new item
            await charityBazaar.createItem("item 5",5,{from:charity});

            // Ensure that each bidder has at least 1 credit
            await charityBazaar.donate(1,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")})
            await charityBazaar.donate(1,{from:bidder_2,
                                         value:web3.utils.toWei("10","Ether")})
            await charityBazaar.donate(1,{from:bidder_3,
                                         value:web3.utils.toWei("10","Ether")})

            // Record the balance of three bidders and the contract before bidding
            let balanceBeforeOrder_bidder_1 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));
            let balanceBeforeOrder_bidder_2 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_2}));
            let balanceBeforeOrder_bidder_3 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_3}));
            let balanceBeforeOrder_contract = web3.utils.toWei(
                                         await charityBazaar.balanceOfContract({from: charity}));

//            console.log("balanceBeforeOrder_contract: "+ balanceBeforeOrder_contract);

            // Three bidders bid for the same item
            await charityBazaar.bidItem(5,7,{from:bidder_2,
                                         value:web3.utils.toWei("7","Ether")});

            await charityBazaar.bidItem(5,5,{from:bidder_1,
                                         value:web3.utils.toWei("5","Ether")});

            await charityBazaar.bidItem(5,9,{from:bidder_3,
                                         value:web3.utils.toWei("9","Ether")});

            // Record the balance of three bidders and the contract after bidding
            let balanceAfterOrder_bidder_1 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));
            let balanceAfterOrder_bidder_2 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_2}));
            let balanceAfterOrder_bidder_3 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_3}));
            let balanceAfterOrder_bidder_contract = web3.utils.toWei(
                                         await charityBazaar.balanceOfContract({from: charity}));

//            console.log("balanceAfterOrder_bidder_contract: "+ balanceAfterOrder_bidder_contract);

            // Charity confirm all order and give the bidder with highest price the item
            await charityBazaar.confirm({from:charity});

            // Record the balance of three bidders and the contract after confirming
            let balanceAfterConfirm_bidder_1 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_1}));
            let balanceAfterConfirm_bidder_2 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_2}));
            let balanceAfterConfirm_bidder_3 = web3.utils.toWei(
                                         await charityBazaar.balanceOfUser({from: bidder_3}));
            let balanceAfterConfirm_bidder_contract = web3.utils.toWei(
                                         await charityBazaar.balanceOfContract({from: charity}));

//            console.log("balanceAfterConfirm_bidder_contract: "+ balanceAfterConfirm_bidder_contract);


            assert.equal(balanceBeforeOrder_bidder_1.toString().substring(0,10),
                         balanceAfterConfirm_bidder_1.toString().substring(0,10),
                         "The money should be refunded to bidder_1")
            assert.equal(balanceBeforeOrder_bidder_2.toString().substring(0,10),
                         balanceAfterConfirm_bidder_2.toString().substring(0,10),
                         "The money should be refunded to bidder_2")
            assert.notEqual(balanceBeforeOrder_bidder_3.toString().substring(0,10),
                         balanceAfterConfirm_bidder_3.toString().substring(0,10),
                         "The money should not be refunded to bidder_3")
            assert.equal(balanceAfterConfirm_bidder_contract.toString(),
                         balanceBeforeOrder_contract.add(web3.utils.toWei(new web3.utils.BN(web3.utils.toWei("9","Ether")))).toString(),
                         "The money in contract should equal to the price offered by bidder_3, which is the highest price")

            let ownerOfIterm = (await charityBazaar.itemList.call(5)).owner;
            assert.equal(ownerOfIterm, bidder_3, "The owner should be bidder_3")
        });
        it('Successful bidder will get a credit as reward, the rest bidder will have the same credit as before', async() => {
            // Create a new item
            await charityBazaar.createItem("item 6",6,{from:charity});

            // Ensure that each bidder has at least 1 credit
            await charityBazaar.donate(1,{from:bidder_1,
                                         value:web3.utils.toWei("10","Ether")})
            await charityBazaar.donate(1,{from:bidder_2,
                                         value:web3.utils.toWei("10","Ether")})
            await charityBazaar.donate(1,{from:bidder_3,
                                         value:web3.utils.toWei("10","Ether")})

            // Record the credit of each bidder before bidding
            let creditBeforeOrder_bidder_1 = (await charityBazaar.creditList.call(bidder_1)).creditRest;
            let creditBeforeOrder_bidder_2 = (await charityBazaar.creditList.call(bidder_2)).creditRest;
            let creditBeforeOrder_bidder_3 = (await charityBazaar.creditList.call(bidder_3)).creditRest;

//            console.log("creditBeforeOrder_bidder_1: " + creditBeforeOrder_bidder_1);
//            console.log("creditBeforeOrder_bidder_2: " + creditBeforeOrder_bidder_2);
//            console.log("creditBeforeOrder_bidder_3: " + creditBeforeOrder_bidder_3);

            // Three bidders bid for the same item
            await charityBazaar.bidItem(6,8,{from:bidder_2,
                                         value:web3.utils.toWei("8","Ether")});

            await charityBazaar.bidItem(6,6,{from:bidder_1,
                                         value:web3.utils.toWei("6","Ether")});

            await charityBazaar.bidItem(6,10,{from:bidder_3,
                                         value:web3.utils.toWei("10","Ether")});


            // Charity confirm all order and give the bidder with highest price the item
            await charityBazaar.confirm({from:charity});

            // Record the credit of each bidder after confirming
            let creditAfterConfirm_bidder_1 = (await charityBazaar.creditList.call(bidder_1)).creditRest;
            let creditAfterConfirm_bidder_2 = (await charityBazaar.creditList.call(bidder_2)).creditRest;
            let creditAfterConfirm_bidder_3 = (await charityBazaar.creditList.call(bidder_3)).creditRest;

//            console.log("creditAfterConfirm_bidder_1: " + creditAfterConfirm_bidder_1);
//            console.log("creditAfterConfirm_bidder_2: " + creditAfterConfirm_bidder_2);
//            console.log("creditAfterConfirm_bidder_3: " + creditAfterConfirm_bidder_3);

            assert.equal(creditBeforeOrder_bidder_1.toString(),creditAfterConfirm_bidder_1.toString(),"The credit of bidder_1 should remain the same");
            assert.equal(creditBeforeOrder_bidder_2.toString(),creditAfterConfirm_bidder_2.toString(),"The credit of bidder_2 should remain the same");
            assert.equal(creditBeforeOrder_bidder_3,creditAfterConfirm_bidder_3 - 1,"The credit of bidder_3 should increase 1");

        });
        it('Only charity can confirm', async() => {
            // Create a new item
            await charityBazaar.createItem("item 7",7,{from:charity});
            await charityBazaar.bidItem(7,7,{from:bidder_1,
                                         value:web3.utils.toWei("7","Ether")});

            await charityBazaar.confirm({from:bidder_1}).should.be.rejected;
        });
        it('The confirm should succeed if these is no issue', async() => {
            // Clear all existing order
            await charityBazaar.confirm({from:charity});

            // Create a new item
            await charityBazaar.createItem("item 8",8,{from:charity});
            await charityBazaar.bidItem(8,8,{from:bidder_1,
                                         value:web3.utils.toWei("8","Ether")});

            await charityBazaar.confirm({from:charity});
        });
    });

    describe('Donate test', async()=>{
        it('Bidder require to donate at least 1 ether each time', async() => {
            await charityBazaar.donate(0,{from:bidder_1,
                                         value:web3.utils.toWei("1","Ether")}).should.be.rejected;
        });
        it('The given ether should be higher than the donatePrice', async() => {
            await charityBazaar.donate(2,{from:bidder_1,
                                         value:web3.utils.toWei("1","Ether")}).should.be.rejected;

        });
        it('Bidder should receive 1 credit as reward for each donation', async() => {
            // Record the credit before donation
            let creditBeforeDonation = (await charityBazaar.creditList.call(bidder_1)).creditRest;

            await charityBazaar.donate(2,{from:bidder_1,
                                         value:web3.utils.toWei("2","Ether")});
            // Record the credit after donation
            let creditAfterDonation = (await charityBazaar.creditList.call(bidder_1)).creditRest;
            assert.equal(creditBeforeDonation,creditAfterDonation - 1,"The credit of bidder_1 should increase 1");

        });
        it('Donate should succeed if there is no issue', async() => {
            await charityBazaar.donate(2,{from:bidder_1,
                                         value:web3.utils.toWei("2","Ether")});
        });
    });
});