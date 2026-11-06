package com.movieticketbooking.service;

import com.movieticketbooking.dao.ReportDao;
import com.movieticketbooking.util.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Map;

@Service
public class ReportService {
    private final ReportDao reportDao;

    public ReportService(ReportDao reportDao) {
        this.reportDao = reportDao;
    }

    public Map<String, Object> createReport(String from, String to) {
        if ((from != null && !isValidDate(from)) || (to != null && !isValidDate(to))) {
            throw new ApiException(HttpStatus.BAD_REQUEST,
                    "Date filters must use a valid YYYY-MM-DD format.");
        }
        if (from != null && to != null && from.compareTo(to) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "The from date must be on or before the to date.");
        }
        return reportDao.createReport(from, to);
    }

    private boolean isValidDate(String value) {
        if (!value.matches("^\\d{4}-\\d{2}-\\d{2}$")) {
            return false;
        }
        try {
            LocalDate.parse(value);
            return true;
        } catch (DateTimeParseException exception) {
            return false;
        }
    }
}
