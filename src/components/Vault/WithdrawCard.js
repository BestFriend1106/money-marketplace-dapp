import React, { useState } from 'react';
import styled from 'styled-components';
import { Row, Icon } from 'antd';
import BigNumber from 'bignumber.js';
import PropTypes from 'prop-types';
import { useWeb3React } from '@web3-react/core';
import NumberFormat from 'react-number-format';
import * as constants from '../../utilities/constants';
import { useXvsVault } from '../../hooks/useContract';
import WithdrawHistoryModal from './WithdrawHistoryModal';
import { CardItemWrapper } from './styles';

const WithdrawCardWrapper = styled.div`
  .card-item {
    padding: 0;
  }
  .request-withdraw {
    display: flex;
    .left {
      flex: 1;
      position: relative;
      border-right: 1px solid #262b48;
      padding: 16px;
    }
    .right {
      position: relative;
      padding: 16px;
      width: 40%;
    }
  }

  .lock-period {
    font-size: 12px;
    line-height: 16px;
  }
  .inner-row {
    width: 100%;
  }
`;

function formatTimeToLockPeriodString(seconds) {
  let remaining = 0;
  const days = Math.floor(seconds / 86400);
  remaining = seconds - days * 86400;
  const hours = Math.floor(remaining / 3600);
  remaining -= hours * 3600;
  const minutes = Math.floor(remaining / 60);
  remaining -= minutes * 60;
  const second = remaining;
  return `${days ? `${days} days ` : ''}${hours ? `${hours} hours ` : ''}${
    minutes ? `${minutes} minutes ` : ''
  }${second ? `${second} seconds` : ''}`;
}

function WithdrawCard({
  poolId,
  stakedToken,
  rewardTokenAddress,
  lockPeriodSecond,
  withdrawableAmount,
  pendingWithdrawals,
  userEligibleStakedAmount
}) {
  const stakedTokenDecimal = new BigNumber(10).pow(
    constants.CONTRACT_TOKEN_ADDRESS[stakedToken].decimals
  );

  const { account } = useWeb3React();
  const xvsVaultContract = useXvsVault();

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState(new BigNumber(0));

  return (
    <WithdrawCardWrapper>
      <CardItemWrapper>
        {/* withdraw area */}
        <div className="card-item request-withdraw">
          <Row className="inner-row" justify="end" type="flex">
            <div className="left">
              <div className="card-title">
                <span>
                  {stakedToken.toUpperCase()} Staked:{' '}
                  {userEligibleStakedAmount.div(stakedTokenDecimal).toFixed(4)}
                </span>
                <Icon
                  type="history"
                  className="icon"
                  onClick={() => setHistoryModalVisible(!historyModalVisible)}
                />
              </div>
              <div className="card-body">
                <div className="input-wrapper">
                  <NumberFormat
                    autoFocus
                    value={
                      withdrawAmount.isZero()
                        ? '0'
                        : withdrawAmount.toString(10)
                    }
                    onValueChange={values => {
                      const { value } = values;
                      setWithdrawAmount(new BigNumber(value));
                    }}
                    isAllowed={({ value }) => {
                      return new BigNumber(value || 0)
                        .multipliedBy(stakedTokenDecimal)
                        .isLessThanOrEqualTo(userEligibleStakedAmount);
                    }}
                    thousandSeparator
                    allowNegative={false}
                    placeholder="0"
                  />
                  <span
                    className="pointer max"
                    onClick={() => {
                      setWithdrawAmount(
                        userEligibleStakedAmount.div(stakedTokenDecimal)
                      );
                    }}
                  >
                    MAX
                  </span>
                </div>
                <div className="lock-period">
                  Locking period:{' '}
                  {formatTimeToLockPeriodString(lockPeriodSecond)}
                </div>
              </div>
              <button
                type="button"
                className="button claim-button"
                disabled={
                  !userEligibleStakedAmount.gt(0) ||
                  !withdrawAmount.gt(0) ||
                  !account
                }
                onClick={() => {
                  xvsVaultContract.methods
                    .requestWithdrawal(
                      rewardTokenAddress,
                      poolId,
                      withdrawAmount.multipliedBy(stakedTokenDecimal)
                    )
                    .send({
                      from: account
                    });
                }}
              >
                Request Withdraw
              </button>
            </div>
            {/* !left */}
            <div className="right">
              <div className="card-title">Withdrawable amount</div>
              <div className="center-amount">
                {withdrawableAmount.div(stakedTokenDecimal).toFixed(4)}{' '}
                {stakedToken.toUpperCase()}
              </div>
              <button
                type="button"
                className="button execute-withdraw-button"
                disabled={!withdrawableAmount.gt(0) || !account}
                onClick={() => {
                  xvsVaultContract.methods
                    .executeWithdrawal(rewardTokenAddress, poolId)
                    .send({ from: account });
                }}
              >
                Withdraw
              </button>
            </div>
          </Row>
        </div>
        <WithdrawHistoryModal
          visible={historyModalVisible}
          onCancel={() => setHistoryModalVisible(false)}
          pendingWithdrawals={pendingWithdrawals}
          withdrawableAmount={withdrawableAmount}
          stakedToken={stakedToken}
        />
      </CardItemWrapper>
    </WithdrawCardWrapper>
  );
}

WithdrawCard.propTypes = {
  poolId: PropTypes.instanceOf(BigNumber).isRequired,
  stakedToken: PropTypes.string.isRequired,
  rewardTokenAddress: PropTypes.string.isRequired,
  lockPeriodSecond: PropTypes.instanceOf(BigNumber).isRequired,
  withdrawableAmount: PropTypes.instanceOf(BigNumber).isRequired,
  pendingWithdrawals: PropTypes.array.isRequired,
  userEligibleStakedAmount: PropTypes.instanceOf(BigNumber).isRequired
};

export default WithdrawCard;
