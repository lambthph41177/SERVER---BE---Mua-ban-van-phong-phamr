import { Spin } from "antd";
import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FormatPrice } from "../Format";
import useDashboard from "../Hook/useDashboard";
import { NumberOrder } from "./Char";

const Dashboards = () => {
  const [searchParams] = useSearchParams();

  const startdate = searchParams.get("startdate") || null;

  let enddateRaw = searchParams.get("enddate");

  if (!enddateRaw) {
    const now = new Date();
    now.setHours(now.getHours() + 7);
    enddateRaw = now.toISOString().split("T")[0];
  } else {
    const temp = new Date(enddateRaw);
    temp.setHours(temp.getHours() + 7);
    enddateRaw = temp.toISOString().split("T")[0];
  }




 
  

console.log(mappedData);
  return (
    <div className="">
      <div className="row mb-3 pb-1">
        <div className="col-12">
          <div className="d-flex align-items-lg-center flex-lg-row flex-column">
            <div className="flex-grow-1">
              <h4 className="fs-16 mb-1">Xin chào, {dataUser.username}!</h4>
              <p className="text-muted mb-0">
                Đây là những gì đang diễn ra với cửa hàng của bạn ngày hôm nay
              </p>
            </div>
            <div className="mt-3 mt-lg-0">
              <form>
                <div className="row g-3 mb-0 align-items-center">
                  <div className="col-sm-auto flex gap-3">
                    <label htmlFor="">Ngày bắt đầu</label>
                    <div className="input-group ">
                      <input
                        type="date"
                        className="form-control border-0 dash-filter-picker shadow"
                        onChange={(e) => setstartDateValue(e.target.value)}
                        value={startDateValue}
                      />
                      <Link
                        to={
                          startDateValue !== undefined
                            ? makeLink("startdate", startDateValue)
                            : null
                        }
                        className="input-group-text bg-primary border-primary text-white"
                      >
                        <i className="ri-calendar-2-line" />
                      </Link>
                    </div>

                    <label htmlFor="">Ngày kết thúc</label>
                    <div className="input-group">
                      <input
                        type="date"
                        className="form-control border-0 dash-filter-picker shadow"
                        onChange={(e) => setendDateValue(e.target.value)}
                        value={endDateValue}
                      />
                      <Link
                        to={
                          endDateValue !== undefined
                            ? makeLink("enddate", endDateValue)
                            : null
                        }
                        className="input-group-text bg-primary border-primary text-white"
                      >
                        <i className="ri-calendar-2-line" />
                      </Link>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

     


      {/* <div className="row">
        <div className="col-xl-12">
          <div className="card p-2">
            <div className="card-header border-0 align-items-center d-flex">
              <h4 className="card-title mb-0 flex-grow-1">
                Tổng số đơn hàng thành công
              </h4>
            </div>
            <TotalOrder chart={mappedData.chart} />
          </div>
        </div>
      </div> */}

  

  
    </div>
  );
};

export default Dashboards;
