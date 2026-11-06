package com.movieticketbooking.model;

public class Movie {
    private int id;
    private String title;
    private String genre;
    private String language;
    private int durationMin;
    private String posterPath;
    private String rating;
    private String description;

    public Movie() {}

    public Movie(int id, String title, String genre, String language, int durationMin, String posterPath, String rating, String description) {
        this.id = id;
        this.title = title;
        this.genre = genre;
        this.language = language;
        this.durationMin = durationMin;
        this.posterPath = posterPath;
        this.rating = rating;
        this.description = description;
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getGenre() { return genre; }
    public void setGenre(String genre) { this.genre = genre; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public int getDurationMin() { return durationMin; }
    public void setDurationMin(int durationMin) { this.durationMin = durationMin; }

    public String getPosterPath() { return posterPath; }
    public void setPosterPath(String posterPath) { this.posterPath = posterPath; }

    public String getRating() { return rating; }
    public void setRating(String rating) { this.rating = rating; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    @Override
    public String toString() {
        return title + " (" + language + " - " + durationMin + " mins)";
    }
}
