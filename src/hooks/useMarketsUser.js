import { useCallback, useEffect, useState } from 'react';
import useRefresh from './useRefresh';
import * as constants from '../utilities/constants';
import { useComptroller } from './useContract';
import { useWeb3React } from '@web3-react/core';
import useWeb3 from './useWeb3';
import { getTokenContract } from '../utilities/contractHelpers';
import BigNumber from 'bignumber.js';
import { methods } from '../utilities/ContractService';
import { useVaiUser } from '../../../hooks/useVaiUser';

export const useMarketsUser = () => {
  const [marketInfo, setMarketInfo] = useState({});
  const { fastRefresh } = useRefresh();
  const comptrollerContract = useComptroller();
  const { account } = useWeb3React();
  const { markets } = useMarketsUser();
  const web3 = useWeb3();
  const { userVaiMinted } = useVaiUser();

  const updateMarketInfo = useCallback(async () => {
    if (!account || !settings.decimals || !markets) {
      return;
    }

    try {
      let xvsBalance = new BigNumber(0);
      const assetsIn = await methods.call(
        comptrollerContract.methods.getAssetsIn,
        [account]
      );

      let totalBorrowLimit = new BigNumber(0);
      let totalBorrowBalance = userVaiMinted;

      const assetList = await Promise.all(
        Object.values(constants.CONTRACT_TOKEN_ADDRESS).map(
          async (item, index) => {
            let market = markets.find(
              ele =>
                ele.underlyingSymbol.toLowerCase() === item.symbol.toLowerCase()
            );
            if (!market) market = {};
            const asset = {
              key: index,
              id: item.id,
              img: item.asset,
              vimg: item.vasset,
              name: market.underlyingSymbol || '',
              symbol: market.underlyingSymbol || '',
              tokenAddress: market.underlyingAddress,
              vsymbol: market.symbol,
              vtokenAddress: constants.CONTRACT_VBEP_ADDRESS[item.id].address,
              supplyApy: new BigNumber(market.supplyApy || 0),
              borrowApy: new BigNumber(market.borrowApy || 0),
              xvsSupplyApy: new BigNumber(market.supplyVenusApy || 0),
              xvsBorrowApy: new BigNumber(market.borrowVenusApy || 0),
              collateralFactor: new BigNumber(market.collateralFactor || 0).div(
                1e18
              ),
              tokenPrice: new BigNumber(market.tokenPrice || 0),
              liquidity: new BigNumber(market.liquidity || 0),
              borrowCaps: new BigNumber(market.borrowCaps || 0),
              totalBorrows: new BigNumber(market.totalBorrows2 || 0),
              walletBalance: new BigNumber(0),
              supplyBalance: new BigNumber(0),
              borrowBalance: new BigNumber(0),
              isEnabled: false,
              collateral: false,
              percentOfLimit: '0'
            };

            const tokenDecimal = settings.decimals[item.id]
              ? settings.decimals[item.id].token
              : 18;
            const vBepContract = getVbepContract(item.id);
            asset.collateral = assetsIn
              .map(item => item.toLowerCase())
              .includes(asset.vtokenAddress.toLowerCase());

            let borrowBalance, supplyBalance, totalBalance;

            // wallet balance
            if (item.id !== 'bnb') {
              const tokenContract = getTokenContract(web3, item.id);
              const [
                walletBalance,
                allowBalance,
                snapshot,
                balance
              ] = await Promise.all([
                methods.call(tokenContract.methods.balanceOf, [account]),
                methods.call(tokenContract.methods.allowance, [
                  account,
                  asset.vtokenAddress
                ]),
                methods.call(vBepContract.methods.getAccountSnapshot, [
                  account
                ]),
                methods.call(vBepContract.methods.balanceOf, [account])
              ]);
              supplyBalance = new BigNumber(snapshot[1])
                .times(new BigNumber(snapshot[3]))
                .div(new BigNumber(10).pow(18));
              borrowBalance = snapshot[2];
              totalBalance = balance;

              asset.walletBalance = new BigNumber(walletBalance).div(
                new BigNumber(10).pow(tokenDecimal)
              );

              if (asset.id === 'xvs') {
                xvsBalance = asset.walletBalance;
              }

              // allowance
              asset.isEnabled = new BigNumber(allowBalance)
                .div(new BigNumber(10).pow(tokenDecimal))
                .isGreaterThan(asset.walletBalance);
            } else {
              const [snapshot, balance, walletBalance] = await Promise.all([
                methods.call(vBepContract.methods.getAccountSnapshot, [
                  account
                ]),
                methods.call(vBepContract.methods.balanceOf, [account]),
                web3.eth.getBalance(account)
              ]);
              supplyBalance = new BigNumber(snapshot[1])
                .times(new BigNumber(snapshot[3]))
                .div(new BigNumber(10).pow(18));
              borrowBalance = snapshot[2];
              totalBalance = balance;

              if (window.ethereum || window.BinanceChain) {
                asset.isEnabled = true;
                asset.walletBalance = new BigNumber(walletBalance).div(
                  new BigNumber(10).pow(tokenDecimal)
                );
              }
            }

            // supply balance
            asset.supplyBalance = new BigNumber(supplyBalance).div(
              new BigNumber(10).pow(tokenDecimal)
            );

            // borrow balance
            asset.borrowBalance = new BigNumber(borrowBalance).div(
              new BigNumber(10).pow(tokenDecimal)
            );

            // percent of limit
            asset.percentOfLimit = new BigNumber(
              settings.totalBorrowLimit
            ).isZero()
              ? '0'
              : asset.borrowBalance
                  .times(asset.tokenPrice)
                  .div(settings.totalBorrowLimit)
                  .times(100)
                  .dp(0, 1)
                  .toString(10);

            // hypotheticalLiquidity
            asset.hypotheticalLiquidity = await methods.call(
              comptrollerContract.methods.getHypotheticalAccountLiquidity,
              [account, asset.vtokenAddress, totalBalance, 0]
            );

            const supplyBalanceUSD = asset.supplyBalance.times(
              asset.tokenPrice
            );
            const borrowBalanceUSD = asset.borrowBalance.times(
              asset.tokenPrice
            );

            totalBorrowBalance = totalBorrowBalance.plus(borrowBalanceUSD);
            if (asset.collateral) {
              totalBorrowLimit = totalBorrowLimit.plus(
                supplyBalanceUSD.times(asset.collateralFactor)
              );
            }

            return asset;
          }
        )
      );

      setSetting({
        assetList,
        totalBorrowLimit: totalBorrowLimit.toString(10),
        totalBorrowBalance,
        userXVSBalance: xvsBalance,
      });
    } catch (error) {
      console.log(error);
    }
  }, [markets, account, web3]);

  useEffect(() => {
    updateMarketInfo();
  }, [fastRefresh]);

  return { marketInfo };
};
