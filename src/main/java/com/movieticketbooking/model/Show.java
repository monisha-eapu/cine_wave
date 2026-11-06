package com.movieticketbooking.model;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Time;

public class Show {
    private int id;
    private int movieId;
    private String movieTitle;
    private int screenId;
    private String screenName;
    private Date showDate;
    private Time showTime;
    private BigDecimal priceSilver;
    private BigDecimal priceGold;
    private BigDecimal pricePlatinum;

    public Show() {}

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public int getMovieId() { return movieId; }
    public void setMovieId(int movieId) { this.movieId = movieId; }

    public String getMovieTitle() { return movieTitle; }
    public void setMovieTitle(String movieTitle) { this.movieTitle = movieTitle; }

    public int getScreenId() { return screenId; }
    public void setScreenId(int screenId) { this.screenId = screenId; }

    public String getScreenName() { return screenName; }
    public void setScreenName(String screenName) { this.screenName = screenName; }

    public Date getShowDate() { return showDate; }
    public void setShowDate(Date showDate) { this.showDate = showDate; }

    public Time getShowTime() { return showTime; }
    public void setShowTime(Time showTime) { this.showTime = showTime; }

    public BigDecimal getPriceSilver() { return priceSilver; }
    public void setPriceSilver(BigDecimal priceSilver) { this.priceSilver = priceSilver; }

    public BigDecimal getPriceGold() { return priceGold; }
    public void setPriceGold(BigDecimal priceGold) { this.priceGold = priceGold; }

    public BigDecimal getPricePlatinum() { return pricePlatinum; }
    public void setPricePlatinum(BigDecimal pricePlatinum) { this.pricePlatinum = pricePlatinum; }
}
